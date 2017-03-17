var _       = require('lodash')
  , Promise = require('bluebird')
  , path    = require('path')
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
            let _filename = path.resolve('/mnt/src/', filename);

            return Promise
                    .try(() => {
                      return require(_filename);
                    });
                    // .catch((err) => {
                    //   console.error(err);
                    //   throw new Error(`module not found: ${filename}`);
                    // });
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