var request = require('request-promise')
var fs = require('fs')
var path = require('path')
var Promise = require("bluebird")
var yamp = require('yamp')

var urlPrefix = 'https://raw.githubusercontent.com/astaxie/build-web-application-with-golang/master/'

function log (str) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(str)
  }
}

function generate (lang) {
  return new Promise(function (resolve) {
    // preface
    log(`Fetch ${lang} preface`)
    return request(`${urlPrefix}${lang}/preface.md`).then(function (body) {
      log(`${lang} preface fetched`)
      // replace preface markdown link to html link
      var replacedPreface = body.replace(/[\*\-] ([a-zA-Z\u4e00-\u9fa5\d\.]+)[ ]?\[([a-zA-Z\u4e00-\u9fa5\uff0c\d\/ ]+)\]\(([\da-zA-Z\.]+\.md)\)/g, (...args) => {
        var list = []
        list = list.concat(args[1].replace(/[\u4e00-\u9fa5]+/, '').split('.'))
        var letter = args[2].match(/[a-zA-Z]+/g)
        if (letter && letter.length) {
          list = list.concat(letter)
        }
        list = list.filter(item => item !== '').map(item => item.toLowerCase())
        // console.log(args[0].replace(args[3], '#' + list.join('-') + (/[\u4e00-\u9fa5]$/.test(args[2]) ? '-' : '')))
        return args[0].replace(args[3], '#' + list.join('-') + (/[\u4e00-\u9fa5]$/.test(args[2]) ? '-' : ''))
      })
      var chapters = body.match(/\(([\da-zA-Z\.]+)\)/g)
      var contents = new Array(chapters.length)
      log(`Fetch ${lang} ${chapters.length} chapters`)
      Promise.all(chapters.map(function (chapter, index) {
        return request(`${urlPrefix}${lang}/${chapter.match(/\(([\da-zA-Z\.]+)\)/)[1]}`).then(function (b) {
          log(`Lang ${lang} chapter ${chapter} fetched`)
          // replace image src
          contents[index] = b.replace(/images\/[\da-zA-Z\.]+/g, function (matched) {
            return `${urlPrefix}${lang}/${matched}`
          }).replace(/preface\.md/, '#pageHeader')
        })
      })).then(function () {
        // all chapters downloaded
        log(`Lang ${lang} all chapters fetched`)
        var str = `${replacedPreface}\n\n${contents.join('\n\n')}`
        var mdFile = path.join(__dirname, `md/${lang}.md`)
        log(`Converting lang ${lang} to pdf`)
        fs.writeFile(mdFile, str, (err) => {
          if (err) {
            console.error(err)
            return resolve()
          }
          var render = new yamp.renderers.pdf({
            outputDirectory: path.join(__dirname, 'pdf'),
            outputFilename: `bwawg-${lang}.pdf`
          })
          render.renderFile(mdFile, function (err) {
            if (err) {
              log("Error while rendering: " + err)
              resolve()
            }
            else {
              log(`bwawg-${lang}.pdf generated`)
              resolve()
            }
          })
        })
      })
    })
  })
}

log('Fetch langs')
request(`${urlPrefix}LANGS.md`).then(function (body) {
  var langs = body.match(/\([a-z-]+\/\)/g)
  var fixLangs = []
  var readmeLinks = []
  var htmlLinks = []
  langs.forEach(function (lang) {
    // remove '(' ')' in lang str
    var _lang = lang.replace(/^\(/, '').replace(/\/\)$/, '')
    fixLangs.push(_lang)
    readmeLinks.push(`[${_lang}](./bwawg-${_lang}.pdf)`)
    htmlLinks.push(`<p><a href="./bwawg-${_lang}.pdf">bwawg-${_lang}.pdf</a></p>`)
  })
  // generate pdf readme file
  log('Generate readme file for pdf folder')
  var readmeStr = '* ' + readmeLinks.join('\n\n* ')
  fs.writeFile(path.join(__dirname, 'pdf/README.md'), readmeStr)
  // generate pdf index.html
  log('Generate index.html for pdf folder')
  var htmlStr = `<html><head><title>bwawg pdf download page</title></head><body>${htmlLinks.join('')}</body></html>`
  fs.writeFile(path.join(__dirname, 'pdf/index.html'), htmlStr)

  // run in order
  Promise.reduce(fixLangs, function (memo, lang) {
    return generate(lang)
  }, 0).then(function () {
    log(`All ${langs.length} lang generated`)
  })
})
