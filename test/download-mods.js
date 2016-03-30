/* global describe, it */
'use strict';
var assert      = require('chai').assert;
var spawn       = require('child_process').spawn;
var fs          = require('fs');
var uuid        = require('node-uuid');

describe('istex-api-harvester', function () {

  it('devrait être capable de télécharger 2 métadonnées au format MODS', function (done) {

    var dirId = uuid.v1();

    var child   = spawn(
      __dirname + '/../istex-api-harvester.njs',
      [ '--size=2', '--metadata=mods', '--output=' + dirId ], { cwd: '/tmp/' });
    
    child.stdout.on('end', function () {
      assert.equal(fs.readdirSync('/tmp/' + dirId).length, 2);
      done();
    })

  });

});
