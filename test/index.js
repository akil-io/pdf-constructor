const fs = require('fs');
const path = require('path');
const moment = require('moment');

const { PDFGenerator } = require('../index.js');

const pdfConfig = {
  info: {
    Title: 'Test ticket',
    Author: 'Test Author'
  },
  pages: [{
    margin: 40,
    layout: 'portrait',
    items: [
      {
        type: 'image',
        src: path.resolve('./test/logo.png'),
        place: [],
        options: {}
      },
      {
        type: "text",
        font: 'Default',
        size: 20,
        options: {},
        value: "${eventDate} — ${eventName}"
      },
      {
        type: "text",
        font: 'Default',
        size: 16,
        options: {},
        value: "${Name} ${Surname}"
      },
      {
        type: 'image',
        src: 'QR',
        place: [],
        options: {},
        qrOptions: {
          errorCorrectionLevel: 'H'
        },
        value: '${DOMAIN}/event/${eventID}/member/${memberID}/_ticket?id=${ticketID}'
      }
    ]
  }]
};


let data = {
  Name: 'Имя',
  Surname: 'Фамилия',
  Email: 'test@test.ru',
  Phone: '+70000000000',
  eventDate: moment().format('DD.MM.YYYY'),
  eventName: "Самая крутая конференция для самых крутых участников",
  eventID: "1",
  memberID: "1",
  ticketID: "test",
  DOMAIN: "http://test.ru"
};

const pdfgen = new PDFGenerator(pdfConfig, data, fs.createWriteStream('./ticket-example.pdf'));
pdfgen.make()
  .then(result => {
    console.log(result);
    process.exit();
  })
  .catch(err => {
    console.log(err);
    process.exit();
  });