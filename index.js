/*jslint node: true, nomen: true, indent: 2 */
/*global Promise*/
"use strict";

var fs = require('fs'),
  xml2js = require('xml2js'),
  R = require('ramda');

function promesifyFS(filename) {
  return new Promise(function (resolve, reject) {
    fs.readFile(filename, 'utf8', function (err, result) {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}

function promesifyXMLParser(text) {
  return new Promise(function (resolve, reject) {
    xml2js.parseString(text, function (err, result) {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}

function readNameSpaceFiles(filename) {
  return new Promise(function (resolveMain, rejectMain) {

    promesifyFS(filename)
      .then(function (result) {
        return promesifyXMLParser(result);
      })
      .then(function (result) {
        var innerclasses = R.head(result.doxygen.compounddef).innerclass,
          readFilesPromises;

        readFilesPromises = R.map(
          function (innerclass) {
            return new Promise(function (resolve, reject) {
              promesifyFS('./../Drider-Engine/Docs/xml/' + innerclass.$.refid + '.xml')
                .then(function (result) {
                  return promesifyXMLParser(result);
                })
                .then(function (result) {
                  var publicfunctions = [],
                    classDetail;

                  if (R.head(result.doxygen.compounddef).sectiondef[1]) {
                    publicfunctions = R.head(result.doxygen.compounddef).sectiondef[1].memberdef;

                    publicfunctions = R.map(
                      R.pick([
                        'type',
                        'definition',
                        'argsstring',
                        'name',
                        'detaileddescription'
                      ]),
                      publicfunctions
                    );
                  }


                  classDetail = {
                    name: innerclass._.substring(11, innerclass._.length),
                    publicfunctions: publicfunctions
                  };

                  resolve(classDetail);
                })
                .catch(function (err) {
                  reject(err);
                });
            });
          },
          innerclasses
        );

        Promise
          .all(readFilesPromises)
          .then(resolveMain)
          .catch(rejectMain);
      })
      .catch(function (err) {
        rejectMain(err);
      });
  });
}

function readResultGoogleTest(filename) {
  return new Promise(function (resolveMain, rejectMain) {

    promesifyFS(filename)
      .then(function (result) {
        return promesifyXMLParser(result);
      })
      .then(function (result) {
        console.log(result);
        if (!result.testsuites.testsuite) {
          resolveMain(testSuites);
        }
        var testSuites = R.map(
            function (test) {
              var testClass = test.$;
              testClass.testCases = R.map(
                function (test) {
                  var tempTest = {};
                  tempTest.data = test.$;
                  tempTest.failure = test.failure;
                  tempTest.name = test.$.name;
                  return tempTest;
                },
                test.testcase
              );
              testClass.testCases.name = test.name;
              return testClass;
            },
            result.testsuites.testsuite
          );
        //testSuites = R.indexBy(R.prop('name'), testSuites);
        resolveMain(testSuites);
      })
      .catch(function (err) {
        rejectMain(err);
      });
  });
  }

Promise
  .all([
    readNameSpaceFiles('./../Drider-Engine/Docs/xml/namespacedrider_s_d_k.xml'),
    readResultGoogleTest('./../Drider-Engine/MathUnitTest/test_detail.xml'),
    readResultGoogleTest('./../Drider-Engine/GraphicsUnitTest/test_detail.xml'),
    readResultGoogleTest('./../Drider-Engine/EngineUnitTest/test_detail.xml')
  ])
  .then(function (responses) {
    var clases = responses[0],
      tests = responses[1];//R.concat(R.concat(responses[1], responses[2]),responses[3]);
    R.forEach(
      function (clase) {
        var indexTest = R.findIndex(R.propEq('name', clase.name))(tests);
        if (indexTest < 0) {
          clase.testFile = "No existe Test con el nombre de la clase";
        }
        else {
          clase.testFile = "Nombre del test: " + tests[indexTest].name;
          clase.testClase = tests[indexTest];
        }
        R.forEach(
          function (func) {
            func.description = "";
            func.testName = "No tiene TEST asignado";
            func.statusTest = "Falta TestCase";
            func.resultTest = "Pendiente"
            if (func.detaileddescription[0].para) {
              R.forEach(
                function (text) {
                  func.description += text + " ";
                },
                func.detaileddescription[0].para
              )
              var indexStartNameTest = func.description.search("TEST::");
              var indexEndNameTest = func.description.search(" ");
              if (indexStartNameTest > -1) {
                func.testName = func.description.substring(indexStartNameTest + 6, indexEndNameTest);
              }
              if (indexTest > -1) {
                var indexCaseTest = R.findIndex(R.propEq('name', func.testName))(tests[indexTest].testCases);
                if (indexCaseTest > -1) {
                  func.statusTest = "TestCase Encontrado";
                  func.test = tests[indexTest].testCases[indexCaseTest];
                  if (func.test.failure) {
                    func.errorFlag = true;
                    func.resultTest = "Error en esta prueba";
                  }
                  else {
                    func.errorFlag = false;
                    func.resultTest = "Prueba Correcta";
                  }
                }
              }
            }

          },
          clase.publicfunctions
        );
      },
      clases
    );
    console.log(clases);
    fs.writeFile("../testGrid/demo/clases.json", JSON.stringify(clases));
  })
  .catch(function (err) {
    console.log(err);
  })
