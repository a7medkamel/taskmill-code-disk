var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
  , vm      = require('vm')
  ;

function Code(data) {
  this.data = data || {};
};

Code.prototype.run = function(req, res, next) {
  let blob      = this.data.blob
    , filename  = this.data.filename
    ;

  return Promise
          .try(() => {
            if (!blob) {
              return require(filename);
            }

            var dirname   = path.dirname(filename)
              // todo [akamel] require might have wrong lookup paths
              , context   = vm.createContext(_.defaults({ module : {}, require : require, __direname : dirname, __filename : filename }, global))
              , script    = new vm.Script(blob, { filename : filename })
              ;

            // todo [akamel] can throw 'Script execution timed out.' explain to user / otherwise hard to understand
            script.runInContext(context, { timeout : 2000 });

            var fct = context.module.exports;
          })
          .catch((err) => {
            throw new Error(`module not found: ${filename}`);
          })
          .then((fct) => {
            if (_.isFunction(fct)) {
              fct.call(req.app, req, res, next);
            } else {
              var err = new Error('module.exports not set to a function');
              err.help_url = 'https://taskmill.io/help';

              throw err;
            }
          });
};

module.exports = Code;