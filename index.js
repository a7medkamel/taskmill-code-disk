var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
  , vm      = require('vm')
  , amp     = require('app-module-path')
  ;

// do this once
amp.addPath(path.join(process.cwd(), 'node_modules'));

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
            let _dirname  = path.resolve('/mnt/src/', path.dirname(filename))
              , _filename = path.resolve('/mnt/src/', filename)
              ;

            if (!blob) {
              return Promise
                      .try(() => {
                        return require(_filename);
                      })
                      .catch((err) => {
                        console.error(err);
                        throw new Error(`module not found: ${filename}`);
                      });
            }

            // todo [akamel] require might have wrong lookup paths
            let context   = vm.createContext(_.defaults({ module : {}, require : require, __dirname : _dirname, __filename : _filename }, global))
              , script    = new vm.Script(blob, { filename : _filename })
              ;

            // todo [akamel] can throw 'Script execution timed out.' explain to user / otherwise hard to understand
            script.runInContext(context, { timeout : 2000 });

            return context.module.exports;
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
};

module.exports = Code;