/* global describe, it */
'use strict';
const assert      = require('chai').assert;
const spawn       = require('child_process').spawn;
const fs          = require('fs-extra');
const os          = require('os');
const path          = require('path');

const fileId = 'surface-chemistry';
const tmpPrefix = path.join(os.tmpdir(),fileId);
let tmpDir,dotcorpusPath;


describe('get-dotcorpus', function () {
  
  // 10 secondes de timeout car test potentiellement long en fonction du réseau
  this.timeout(10000);
  
  before(function(done) {
    tmpDir = fs.mkdtempSync(tmpPrefix);
    return done();
  });


  it('devrait être capable de récupérer un fichier .corpus et csv', function (done) {

    dotcorpusPath = path.join(tmpDir,fileId + '.corpus');
    const csvPath = path.join(tmpDir,fileId + '.csv');
    if (fs.existsSync(dotcorpusPath)) fs.unlinkSync(dotcorpusPath);

    const spawnOptions= [ __dirname + '/../get-dotcorpus.njs',
    '-q', 'title:"surface chemistry" AND corpusName:oup',
    '-o', dotcorpusPath,
    '-c', 'idIstex,doi,host.issn'
    ];

    const child = spawn('node',spawnOptions,{});

    child.stdout.on('data', function (data) {
      // console.log(`stdout: ${data}`);
    });

    child.stdout.on('end', function () {
      assert.equal(fs.existsSync(tmpDir),true,"le répertoire "+tmpDir+" doit avoir été créé");
      assert.equal(fs.existsSync(dotcorpusPath),true,"le fichier "+dotcorpusPath+" doit exister");
      const n = lineCountSync(dotcorpusPath);
      const filesNumber = 4;
      assert.isAbove(n,filesNumber,"Le fichier .corpus doit contenir plus de "+filesNumber+" lignes");
      const csvLines = lineCountSync(csvPath);
      assert.equal(csvLines,filesNumber,"Le fichier .csv doit contenir exactement "+filesNumber+" lignes");
      done();
    });

  });

  it('devrait être capable de télécharger les fichiers correspondant à test/dataset/surface-chemistry.corpus', function (done) {
    const harvestPath = path.join(tmpDir,fileId); 
    dotcorpusPath = path.join(__dirname,'dataset','surface-chemistry.corpus');
    const spawnOptions= [ path.join(__dirname, '..','dotcorpus-harvest.njs'),
    '-d', dotcorpusPath,
    '-o', harvestPath,
    '-M', 'mods,json',
    '-w', '3'
    ];

    const child = spawn('node',spawnOptions,{});

    child.stdout.on('data', function (data) {
      // console.log(`stdout: ${data}`);
    });

    const arks = [
      'ark:/67375/VQC-R76FXLJ5-T',
      'ark:/67375/1BB-DNM7M531-K',
      'ark:/67375/VQC-7B9XF52R-5'
    ];

    child.stdout.on('end', function () {

      arks.forEach(ark => {
        const arkFilePrefix = '67375_'+ark.substring(11);
        const docDir = path.join(harvestPath,ark[15],ark[16],ark[17]);
        const modsPath = path.join(docDir,arkFilePrefix + '.metadata.mods.xml');
        assert.equal(fs.existsSync(modsPath),true,"le fichier "+modsPath+" doit exister");
        const jsonPath = path.join(docDir,arkFilePrefix + '.metadata.json');
        assert.equal(fs.existsSync(jsonPath),true,"le fichier "+jsonPath+" doit exister");
      });
      done();
    });

  });

  after(function(done) {
    if (fs.existsSync(tmpDir)) fs.removeSync(tmpDir);
    return done();
  });

  const lineCountSync = function(filePath) {
    var data=fs.readFileSync(filePath);
    var res=data.toString().split('\n').length;
    return (res-1);
  };


});
