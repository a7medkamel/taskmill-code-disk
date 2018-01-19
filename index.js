"use strict";

var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
  , mime    = require('mime-types')
  , marked  = require('marked')
  , fse     = require('fs-extra')
  , viz     = require('viz.js')
  , dot     = require('dotparser')
  , pug     = require('pug')
  , man     = require('taskmill-core-man')
  ;

// Synchronous highlighting with highlight.js
marked.setOptions({
  highlight: function (code, lang) {
    switch(lang) {
      case 'dot':
      return viz(code);
      break;
      default:
      return require('highlight.js').highlightAuto(code).value;
    }
  }
});

class Code {
  constructor (data = {}) {
    this.data = data;
  }

  static func_info(req) {
    let name = path.relative('/', req.path);

    return {
        name
      , filename  : path.resolve('/mnt/src/', name)
      , mime_type : mime.lookup(name)
    };
  }

  static text(req) {
    let { filename } = Code.func_info(req);

    return Promise.fromCallback((cb) => fse.readFile(filename, 'utf8', cb));
  }

  static man(req) {
    return Code
            .text(req)
            .then((text) => {
              return man.get(text);
            });
  }

  run(req, res, next) {
    // return res.send({ path : req.path, base_url : req.get('base_url') });
    // let base_url = req.get('base_url');
    // let filename = path.relative(base_url, req.path);
    let { filename, mime_type } = Code.func_info(req);

    // todo [akamel] exception here doesn't return err to browser
    return Promise
            .try(() => {
              switch(mime_type) {
                case 'application/javascript':
                  let fct = require(filename);

                  if (_.isFunction(fct)) {
                    return fct(req, res, next);
                  } else {
                    let err = new Error('module.exports not set to a function');
                    err.help_url = 'https://taskmill.io/help';

                    throw err;
                  }
                break;
                case 'text/x-markdown':
                  return Code
                          .text(req)
                          .then((text) => {
                            let pref = req.accepts(['text/x-markdown', 'text/html']);

                            if (pref == 'text/x-markdown') {
                              return text;
                            }

                            let options = { gfm : true };

                            let md      = require('marked').lexer(text, options)
                              , graph   = _.find(md, o => o.type == 'code' && o.lang == 'dot')
                              , parsed  = dot(graph.text)
                              ;

                            // style https://github.com/sindresorhus/github-markdown-css
                            return Promise
                                    .fromCallback((cb) => marked(text, options, cb))
                                    .then((part) => {
                                      return pug.renderFile(path.join(__dirname, './view/markdown.pug'), { markdown : part })
                                    });
                          })
                          .then((html) => res.send(html));
                break;
                case 'text/html':
                default:
                  return Promise.fromCallback((cb) => res.sendFile(filename, cb));
                break;
              }
            });
  }
}

module.exports = Code;
