/* global describe, it */
'use strict';
var assert      = require('chai').assert;
var spawn       = require('child_process').spawn;
var fs          = require('fs');
var uuid        = require('node-uuid');

describe('istex-api-harvester', function () {
  // 10 secondes de timeout car test potentiellement long en fonction du réseau
  this.timeout(10000);

  it('devrait être capable de télécharger 2 métadonnées au format MODS', function (done) {

    var dirId = uuid.v1();

    var child   = spawn(
      'node',
      [ __dirname + '/../istex-api-harvester.njs',
        '--size=2',
        '--metadata=mods',
        '--output=' + dirId ], { cwd: '/tmp/' });
    
    child.stdout.on('end', function () {
      assert.equal(fs.readdirSync('/tmp/' + dirId).length, 2);
      done();
    })

  });

});
