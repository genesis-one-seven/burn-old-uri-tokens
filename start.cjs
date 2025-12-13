const xahau = require("xahau");

const path = require('path');
const { ALPN_ENABLED } = require('constants');
const { Console, log } = require('console');

const {
  derive,
  utils,
  signAndSubmit,
} = require("xrpl-accountlib");

const wss = 'wss://xahau.network';

require('dotenv').config({ path: path.resolve(__dirname, '.env') })

var reputationAccounts = [];
if (process.env.reputationAccounts != null)
  reputationAccounts = process.env.reputationAccounts.split('\n');

function getAccountNumber(account)
{
  var keys = account.split(" ");
  for(var ii=0;ii<keys.length;ii++)
  {
    if(keys[ii][0]=='r' && keys[ii].length>=30)
      return keys[ii];
  }
  //log("Account " + account + " does not contain a valid account number");  
}

function getAccountSecret(account)
{
  var keys = account.split(" ");
  for(var ii=0;ii<keys.length;ii++)
    if(keys[ii][0]=="s" && keys[ii].length>=20)
      return keys[ii];
  //log("Account " + account + " does not contain a valid secret key");
}

async function main() {
  const client = new xahau.Client("wss://xahau.network");
  await client.connect();
var i = 0;
  for (const account of reputationAccounts) {
    if (account) {
      i=i+1;
      var accountNumber = getAccountNumber(account);

      const response = await client.request({
        command: "account_info",
        account: accountNumber,
        ledger_index: "validated",
      });
      console.log("Sequence for account " + accountNumber + " = " + response.result.account_data.Sequence);

      await getOldURITokens(account, response.result.account_data.Sequence);
    }
  }
  await client.disconnect();
}

async function getLatestValidatedLedger() {
 
    const client = new xahau.Client("wss://xahau.network");
    await client.connect();
    
    // Richiesta per l'ultimo ledger validato
    const response = await client.request({
      command: 'ledger',
      ledger_index: 'validated'  // Recupera l'ultimo ledger chiuso
    });

    //console.log(JSON.stringify(response));
    // Stampa i dettagli principali del ledger
    const ledger = response.result.ledger;
    //console.log(`- Indice: ${ledger.ledger_index}`);
    await client.disconnect();

    return ledger.ledger_index;

    // Se vuoi dettagli completi (stato del ledger), stampa tutto
    // console.log('Dettagli completi:', JSON.stringify(ledger, null, 2));
    
}


async function getOldURITokens(account, sequence) {
  let marker = undefined;
  const oldTokens = [];

  const client = new xahau.Client("wss://xahau.network");
  await client.connect();
  
  var lastLedger= await getLatestValidatedLedger();

  //console.log("last ledger = " + lastLedger);
  do {
    const response = await client.request({
      command: 'account_objects',
      account: getAccountNumber(account),
      type: 'uri_token',
      ledger_index: 'validated',
      limit: 400,
      marker: marker
    });

    //console.log ("account_objects " + JSON.stringify(response));

    for (const obj of response.result.account_objects) {
      // URIToken ha il campo IssuedAt o usa il ledger del mint
      const issuedLedger = obj.PreviousTxnLgrSeq;

      //console.log(JSON.stringify(obj));  
      
      //console.log("uri = " + obj.index + " iSSUED LEDGER= " + issuedLedger);
      

      if (lastLedger - issuedLedger >  2000) {
        console.log("old token = " + obj.index + " " + getAccountNumber(account));
        await signAndSubmitURITokenBurn(getAccountSecret(account), obj.index, sequence);
        sequence= sequence + 1;
      }
    }

    marker = response.marker;
  } while (marker);
 await client.disconnect();
  return oldTokens;
}

async function signAndSubmitURITokenBurn(seed, uriTokenId, sequence) {
  
    const account = derive.familySeed(seed);
    const networkInfo = await utils.txNetworkAndAccountValues(wss, account);
    
    console.log("sequence = " + sequence);
   

    const transaction = {
      TransactionType: 'URITokenBurn',  // Supportato nativamente in xahau.js!
      Account: account.address,
      URITokenID: uriTokenId,  // Es. da account_objects
      Sequence: sequence,
      ...networkInfo.txValues,
      Fee: '100'
    };
    console.log("Transazione = " + JSON.stringify(transaction));
    const submitted = await signAndSubmit(transaction, wss, account)
    console.log('Transazione firmata! ' + JSON.stringify(submitted));
    
}




main();