#!/usr/bin/env node
"use strict";

const program = require('commander');
const request = require('superagent');
const async = require('async');
const fs = require('fs');
const dateformat = require('dateformat');
const agent = request.agent();
const jsonPackage = require('./package.json');
const cliProgress = require('cli-progress');
const readline = require('readline');
var objectPath = require("object-path");

program
  .version(jsonPackage.version)
  .option('-q, --query [requete]', "La requete (?q=) ", '*')
  .option('-j, --jwt [token]', "Le token à utiliser pour l'authentification", 'cyIsImxhc3ROYW1lIjoiQk9ORE8iLCJ')
  .option('-o, --output [corpusFile path]', "fichier .corpus obtenu", ".corpus")
  .option('-c, --csv [coma-separated-columns]', "génère un fichier csv en plus du .corpus, en extrayant des infos du json selon [columns]")
  .option('-i, --idIstex', "récupère des idIstex au lieu d'identifiants ARK", false)
  .option('-H, --host [host:port]', "interrogation sur un hostname (ou @IP) particulier", "")
  .option('-v, --verbose', "Affiche plus d'informations", false)
  .parse(process.argv);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const prefixUrl = (program.host !== "") ? "http://" + program.host : "https://api.istex.fr";
const scrollDuration = "1m";
const pageSize = 1000;
const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
let firstCallUrl = prefixUrl + '/document/?q=' + program.query + '&output=id,arkIstex&scroll='+scrollDuration+'&size='+pageSize;
const dotCorpusPath = (program.output && program.output !== '') ? program.output : ".corpus";
let scrollAgain = true;
let csvOutputStream, csvColumns, csvString = '';

let nextScrollURI = '';

let outputStreamflag = 'a';

let startJob = function() {
    let outputStream = fs.createWriteStream(dotCorpusPath, {
        flags: outputStreamflag,
        encoding: 'utf8'
    });

    if (program.csv) {
        if (program.csv.indexOf('idIstex')>=0) {
            program.csv = program.csv.replace("idIstex","id");
        }
        if (program.csv.indexOf('[')>=0) {
            program.csv = program.csv.replace(/\[(\d+)\]/g,".$1");
        }
        const csvPath = (program.output && program.output !== '') ? program.output.replace(/\.corpus$/,'.csv') : '.corpus';
        csvOutputStream = fs.createWriteStream(csvPath, {
            flags: outputStreamflag,
            encoding: 'utf8'    
        });
        csvColumns = program.csv.split(',');
        if (program.csv) {
            let outputFields = csvColumns.map(col => {
                return (col.indexOf('.') > 0) ? col.replace(/^(\w+)\..*$/,"$1") : col;
            });
            firstCallUrl = firstCallUrl.replace("output=id,arkIstex","output="+outputFields.join(','));
        }
    }

    let total = 0, idx = 0;
    let stringBulk = '';

    async.whilst(
        () => {return scrollAgain;},
        (cbWhilst) => {

            const url = (nextScrollURI !== '') ? nextScrollURI : firstCallUrl;
            let extraParams = '&sid=istex-api-harvester';
            if (program.verbose) console.log(url);

            // to ignore bad https certificate
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            agent.get(url+extraParams)
            .set('Authorization', 'Bearer ' + program.jwt)
            .end(function (err, res) {
                if (err) {
                    console.log('ERROR intern: ', err);
                    return cbWhilst(new Error(err));
                }
                if (!res || !res.body || !res.body.hits) {
                    if (res.statusCode !== 404) {
                    return cbWhilst(new Error('Response error: statusCode=' + res.statusCode));
                    }
                    else {
                    console.error('ERROR %d retrieving next %s hits : scroll session may have expired. Try to increase value of -t/--scroll parameter.', res.statusCode);
                    console.error('URL : %s', url);
                    return cbWhilst(new Error('Response error: statusCode=' + res.statusCode));
                    }
                }

                if (total===0) {
                    total = res.body.total;
                    console.log(res.body.total + " documents trouvés. Récupération des identifiants :");
                    console.log("progression");
                    stringBulk = `#
# Fichier .corpus
#
query        : ${program.query}
date         : ${dateformat(new Date(), "isoDateTime")}
total        : ${res.body.total}

[ISTEX]
`;

                    progressBar.start(res.body.total, 0);
                }
                if (res.body && res.body.hits.length > 0) {
                    idx += res.body.hits.length;
                    progressBar.update(idx);
                }

                if (res.body.noMoreScrollResults) scrollAgain = false;
                if (res.body.nextScrollURI) nextScrollURI = res.body.nextScrollURI;

                if (program.idIstex) {
                    const listIds = res.body.hits.map(hit => 'id '+hit.id);
                    stringBulk += listIds.join("\n") + "\n";
                } else {
                    const listArks = res.body.hits.map(hit => 'ark '+hit.arkIstex);
                    stringBulk += listArks.join("\n") + "\n";
                }

                if (program.csv) {
                    csvString += res.body.hits.map(hit => {
                        const values = [];
                        for (const col of csvColumns) {
                            const value = objectPath.get(hit,col);
                            values.push((value) ? '"'+value+'"' : '""');
                        }
                        return values.join(',');
                    }).join("\n");
                }

                outputStream.write(stringBulk, ()=>{
                    stringBulk = "";
                    if (program.csv) {
                        csvOutputStream.write(csvString+"\n", ()=>{
                            csvString = "";
                            cbWhilst();
                        });
                    } else {
                        cbWhilst();
                    }
                });
            
            });
        }, (err) => {
            outputStream.end();
            if (program.csv) csvOutputStream.end();
            progressBar.stop();
            if (err) return console.error(err);
            if (program.verbose) console.log('Téléchargements terminés');
            process.exit(0);
        }
    );

};

if (fs.existsSync(dotCorpusPath)) {
    rl.question('Fichier "+dotCorpusPath+" déjà existant. Voulez-vous l\'écraser ? ', (answer) => {
        if (!['o','O','y','Y'].includes(answer)) {
            console.log('Vous souhaitez le conserver. Veuillez donc choisir un autre emplacement.');
            process.exit(1);
        }
        rl.close();
        outputStreamflag = 'w';
        console.log('Vous souhaitez l\'écraser. Début du traitement.');
        startJob();
    });
} else {
    startJob();
}