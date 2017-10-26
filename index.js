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
        var kinds = [];
        readFilesPromises = R.map(
          function (innerclass) {
            return new Promise(function (resolve, reject) {
              promesifyFS('./../Drider-Engine/Docs/xml/' + innerclass.$.refid + '.xml')
                .then(function (result) {
                  return promesifyXMLParser(result);
                })
                .then(function (result) {
                  var functions = [],
                    classDetail;

                  if (R.head(result.doxygen.compounddef).sectiondef) {
                    var sections = R.head(result.doxygen.compounddef).sectiondef;
                    /*console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
                    console.log(innerclass.$.refid);
                    R.forEach(
                      function (lu) {
                        console.log(lu.$.kind);
                        var flago = R.findIndex(R.propEq('name', lu.$.kind))(kinds);
                        if (flago === -1) {
                          kinds.push({name: lu.$.kind});
                        }
                      },
                      sections
                    );
                    console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&");
                    console.log(kinds);*/
                    R.forEach(
                      function (section) {
                        if (section.$.kind.search("func") > -1) {
                          var tempFunctions = section.memberdef;

                          tempFunctions = R.map(
                            R.pick([
                              'type',
                              'definition',
                              'argsstring',
                              'name',
                              'detaileddescription'
                            ]),
                            tempFunctions
                          );
                          functions = R.concat(functions, tempFunctions);
                        }
                      },
                      sections
                    )
                  }

                  classDetail = {
                    name: innerclass._.substring(11, innerclass._.length),
                    functions: functions
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
        if (!result.testsuites.testsuite) {
          resolveMain([]);
          return;
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
        resolveMain(testSuites);
      })
      .catch(function (err) {
        var error = {error: true};
        resolveMain(error);
      });
  });
  }

Promise
  .all([
    readNameSpaceFiles('./../Drider-Engine/Docs/xml/namespacedrider_s_d_k.xml'),
    readResultGoogleTest('./../Drider-Engine/MathUnitTest/test_detail.xml'),
    readResultGoogleTest('./../Drider-Engine/GraphicsUnitTest/test_detail.xml'),
    readResultGoogleTest('./../Drider-Engine/EngineUnitTest/test_detail.xml'),
    readResultGoogleTest('./../Drider-Engine/CoreUnitTest/test_detail.xml')
  ])
  .then(function (responses) {
    var clases = responses[0],
      tests = [];//R.concat(R.concat(responses[1], responses[2]),responses[3]);
      if (responses[1].error) {
        console.log("no existe math unit test");
      }
      else {
        console.log("Math cargado Correctamente");
        tests = R.concat(tests, responses[1]);
      }
      if (responses[2].error) {
        console.log("no existe Graphics unit test");
      }
      else {
        console.log("Graphics cargado Correctamente");
        tests = R.concat(tests, responses[2]);
      }
      if (responses[3].error) {
        console.log("no existe Engine unit test");
      }
      else {
        console.log("Engine cargado Correctamente");
        tests = R.concat(tests, responses[3]);
      }
      if (responses[4].error) {
        console.log("no existe Core unit test");
      }
      else {
        console.log("Core cargado Correctamente");
        tests = R.concat(tests, responses[4]);
      }
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
                  if (text._) {
                    func.description += text._ + " ";
                  }
                  else {
                    func.description += text + " ";
                  }
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
          clase.functions
        );
      },
      clases
    );
    fs.writeFile("../testGrid/demo/clases.json", JSON.stringify(clases));
  })
  .catch(function (err) {
    console.log(err);
  })
