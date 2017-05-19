var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
  , amp     = require('app-module-path')
  , mime    = require('mime-types')
  , marked  = require('marked')
  , fse     = require('fs-extra')
  , viz     = require('viz.js')
  , dot     = require('dotparser')
  ;

// do this once
amp.addPath(path.join(process.cwd(), 'node_modules'));

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

                          let options = { gfm : true };

                          let md      = require('marked').lexer(text, options)
                            , graph   = _.find(md, o => o.type == 'code' && o.lang == 'dot')
                            , parsed  = dot(graph.text)
                            ;


                          // style https://github.com/sindresorhus/github-markdown-css
                          return Promise
                                  .fromCallback((cb) => marked(text, options, cb))
                                  .then((part) => {
                                    return `<html>
                                              <head>
                                                <style>
                                                  @import url("https://rawgit.com/sindresorhus/github-markdown-css/gh-pages/github-markdown.css");
                                                  @import url("https://rawgit.com/isagalaev/highlight.js/master/src/styles/github.css");

                                                  @import url("https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css");

                                                  body {
                                                    box-sizing: border-box;
                                                    min-width: 200px;
                                                    max-width: 980px;
                                                    margin: 0 auto;
                                                    padding: 45px;
                                                  }

                                                  ul {
                                                    margin: 0;
                                                  }

                                                  body { padding-bottom: 70px; }
                                                </style>
                                                <script src="https://code.jquery.com/jquery-3.2.1.min.js" integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4=" crossorigin="anonymous"></script>
                                                <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
                                                <script>
                                                  $(function(){
                                                    let elm = $('#flow-run');


                                                    
                                                    // window.dot = elm.find('pre').text();

                                                    elm.click(function(e) {
                                                      e.preventDefault();

                                                      $.post({
                                                          url : 'http://' + window.location.hostname + ':8030' + window.location.pathname
                                                      });
                                                      // console.log(window.dot);
                                                    });
                                                  })
                                                </script>
                                              </head>
                                              <body class='markdown-body'>
                                                ${part}
                                                <pre style='display:block;'>${JSON.stringify(parsed, null, ' ')}</pre>
                                                <nav class="navbar navbar-default navbar-fixed-bottom navbar-inverse">
                                                  <div class="container">
                                                    <div class="navbar-header">
                                                      <a class="navbar-brand" href="#">Breadboard</a>
                                                    </div>
                                                    <ul class="nav navbar-nav navbar-right">
                                                      <li><button id="flow-run" type="button" class="btn btn-default navbar-btn">Run</button></li>
                                                    </ul>
                                                  </div>
                                                </nav>
                                              </body>
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