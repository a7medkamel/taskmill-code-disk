var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
  , amp     = require('app-module-path')
  , mime    = require('mime-types')
  , marked  = require('marked')
  , fse     = require('fs-extra')
  ;

// do this once
amp.addPath(path.join(process.cwd(), 'node_modules'));

// Synchronous highlighting with highlight.js 
marked.setOptions({
  highlight: function (code) {
    return require('highlight.js').highlightAuto(code).value;
  }
});

function Code(data) {
  this.data = data || {};
};

Code.prototype.run = function(req, res, next) {
  let blob      = this.data.blob
    , filename  = this.data.filename
    ;

    // todo [akamel] exception here doesn't return err to browser
  return Promise
          .try(() => {
            let _filename = path.resolve('/mnt/src/', filename)
              , mime_type = mime.lookup(_filename)
              ;

            switch(mime_type) {
              case 'application/javascript':
                return Promise
                        .try(() => {
                          return require(_filename);
                        })
                        .then((fct) => {
                          if (_.isFunction(fct)) {
                            return fct.call(req.app, req, res, next);
                          } else {
                            let err = new Error('module.exports not set to a function');
                            err.help_url = 'https://taskmill.io/help';

                            throw err;
                          }
                        });
              break;
              case 'text/x-markdown':
                return Promise
                        .fromCallback((cb) => fse.readFile(_filename, 'utf8', cb))
                        .then((text) => {
                          let pref = req.accepts(['text/x-markdown', 'text/html']);

                          if (pref == 'text/x-markdown') {
                            return text;
                          }

                          // style https://github.com/sindresorhus/github-markdown-css
                          return Promise
                                  .fromCallback((cb) => marked(text, { gfm : true }, cb))
                                  .then((part) => {
                                    return `<html>
                                              <head>
                                                <style>
                                                  @import url("https://rawgit.com/sindresorhus/github-markdown-css/gh-pages/github-markdown.css");

                                                  body {
                                                    box-sizing: border-box;
                                                    min-width: 200px;
                                                    max-width: 980px;
                                                    margin: 0 auto;
                                                    padding: 45px;
                                                  }
                                                </style>
                                              </head>
                                              <body class='markdown-body'>${part}</body>
                                            </html>`;
                                  })
                                  ;
                        })
                        .then((html) => res.send(html));
              break;
              case 'text/html':
              default:
                return Promise.fromCallback((cb) => res.sendFile(_filename, cb));
              break;
            }
          });
};
                    // .catch((err) => {
                    //   console.error(err);
                    //   throw new Error(`module not found: ${filename}`);
                    // });

module.exports = Code;