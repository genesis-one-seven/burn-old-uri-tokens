// set-regular-key-xahau-ledger.cjs
const { Client } = require('xrpl');
const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid');
const Xrp = require('@ledgerhq/hw-app-xrp');
const { encode } = require('ripple-binary-codec');

const NETWORK = 'wss://xahau.network';
const REGULAR_KEY = ''// '';   // ← MODIFICA QUI

const PATH = "44'/144'/0'/0/0";

async function main() {
  console.log("=== SetRegularKey su Xahau con Ledger Nano S Plus (CommonJS) ===\n");

  let transport = null;

  try {
    // Correzione importante per CommonJS
    const Transport = TransportNodeHid.default || TransportNodeHid;
    transport = await Transport.create();

    const LedgerApp = Xrp.default || Xrp;
    const ledger = new LedgerApp(transport);

    console.log("Recupero indirizzo dal Ledger...");
    const device = await ledger.getAddress(PATH);
    const account = device.address;
    const publicKey = device.publicKey.toUpperCase();

    console.log(`Account: ${account}`);

    const client = new Client(NETWORK);
    await client.connect();
    console.log("✅ Connesso a Xahau Mainnet");

    let tx = {
      TransactionType: "SetRegularKey",
      Account: account,
      RegularKey: REGULAR_KEY,
    };

    const prepared = await client.autofill(tx);
    prepared.SigningPubKey = publicKey;

    console.log(`NetworkID: ${prepared.NetworkID || 'non presente'} | Fee: ${prepared.Fee}`);

    console.log("\nTransazione preparata → Firma sul Ledger Nano S Plus...");

    const txBlobForLedger = encode(prepared);
    const signature = await ledger.signTransaction(PATH, txBlobForLedger);

    prepared.TxnSignature = signature;
    const tx_blob = encode(prepared);

    console.log("Invio transazione alla rete...");

    const result = await client.request({ command: 'submit', tx_blob });

    console.dir(result, { depth: null });

    if (result.result.engine_result === "tesSUCCESS") {
      console.log("\n✅ TRANSAZIONE ESEGUITA CON SUCCESSO!");
      console.log(`Hash: ${result.result.tx_json.hash}`);
      console.log(`Explorer: https://explorer.xahau.network/transactions/${result.result.tx_json.hash}`);
    } else {
      console.error("❌ Errore submit:", result.result.engine_result_message || result);
    }

  } catch (err) {
    console.error("\n❌ Errore:", err.message);
    console.error(err);
  } finally {
    if (transport) {
      await transport.close().catch(() => {});
    }
  }
}

main();


/*{
  "name": "regularkey",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@ledgerhq/hw-app-xrp": "^6.36.0",
    "@ledgerhq/hw-transport-node-hid": "^6.32.1",
    "ripple-binary-codec": "^2.7.0",
    "xrpl": "^2.14.0"
  }
} */
