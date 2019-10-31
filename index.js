const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const os = require('os');
const _ = require('lodash');
const path = require('path');
const util = require('util');
const moment = require('moment');
const request = require('request');

class PDFGenerator {
  constructor(config, vars, output) {
    this.config = _.defaultsDeep({}, {
      format: 'A4',
      fonts: {
        Default: path.resolve('./assets/Roboto-Light.ttf')
      },
      info: {
        Title: '',
        Author: '',
        Subject: '',
        Keywords: '',
        CreationDate: new Date(),
        ModDate: new Date()
      },
      pages: []
    }, config);
    this.vars = vars;
    this.doc = new PDFDocument({
      autoFirstPage: false,
      info: this.config.info
    });
    this.stream = this.doc.pipe(output);

    this.resources = new Set();
    this.cache = new Map();
    this.result = null;
  }

  make() {
    return new Promise((resolve, reject) => {
      this.getResources()
        .then(() => {
          Promise.all(this.config.pages.map(this.makePage.bind(this)))
            .then(() => {
              resolve(this.result);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  makePage(pageConfig) {
    return new Promise((resolve, reject) => {
      Object.keys(this.config.fonts).map(fontName => {
        let resourcePath = this.getResourcePath(this.config.fonts[fontName]);
        if (resourcePath) {
          this.doc.registerFont(fontName, resourcePath);
        }
      });

      this.doc.addPage({
        margin: pageConfig.margin,
        size: this.config.format,
        layout: pageConfig.layout
      });

      pageConfig.items.map(item => {
        switch (item.type) {
          case "text":
            this.doc.font(item.font)
              .fontSize(item.size)
              .fillColor(item.color || "black")
              .text(this.getStringValue(item.value), item.options);
            break;
          case "image":
            this.doc.image(this.getResourcePath(item.src), item.place[0], item.place[1], item.options || {});
            break;
          case "space":
            this.doc.moveDown(item.value);
            break;
          default:
            break;
        }
      });

      this.doc.end();
      this.stream.on('finish', () => {
        resolve();
      });
    });
  }

  getStringValue(str) {
    let result = str;
    Object.keys(this.vars).map(varName => {
      result = result.replace(`\$\{${varName}\}`, this.vars[varName]);
    });
    return result;
  }

  getResourcePath(pathName) {
    return this.cache.get(pathName) || null;
  }

  getResources() {
    return new Promise((resolve, reject) => {
      Object.values(this.config.fonts).map(filePath => this.resources.add(filePath));
      this.config.pages.map(page => {
        page.items.map(item => (item.type === 'image') ? this.resources.add((item.src === 'QR') ? item : item.src) : null)
      });

      Promise.all([...this.resources].map(this.getResourceItem.bind(this)))
        .then(resolve)
        .catch(reject);
    });
  }

  getResourceItem(resourcePath) {
    return new Promise((resolve, reject) => {
      if (typeof resourcePath === "string") {
        fs.access(resourcePath, fs.constants.R_OK, (err) => {
          if (!err) {
            this.cache.set(resourcePath, resourcePath);
            resolve(resourcePath);
          } else {
            this.downloadResource(resourcePath)
              .then(localPath => {
                this.cache.set(resourcePath, localPath);
                resolve(localPath);
              })
              .catch(reject);
          }
        });
      } else {
        if (resourcePath.src === "QR") {
          let qrCodeValue = this.getStringValue(resourcePath.value);
          this.result = qrCodeValue;
          let qrCodeImage = QRCode.toDataURL(qrCodeValue, {
            errorCorrectionLevel: resourcePath.qrOptions.errorCorrectionLevel || "H",
            type: 'png'
          }, (err, url) => {
            if (!err) {
              this.cache.set(resourcePath.src, url);
              resolve(url);
            } else reject();
          });
        }
      }
    });
  }

  downloadResource(resourceURL) {
    return new Promise((resolve, reject) => {
      let localPath = path.join(os.tmpdir(), Date.now() + '_' + resourceURL.split('/').pop());

      request
        .get(resourceURL)
        .on('response', function(response) {
          if (response.statusCode !== 200) reject();
        })
        .pipe(fs.createWriteStream(localPath).on('finish', () => {
          resolve(localPath);
        }));
    });
  }
}

module.exports = {
  PDFGenerator
};