import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

function generateSensitiveTxt(outputDir, fileName) {
    const filePath = path.join(outputDir, fileName);
    const fileContent = `
Name: ${faker.person.fullName()}
SSN: ${faker.string.numeric({ length: 9 })}
Credit Card: ${faker.finance.creditCardNumber()}
Email: ${faker.internet.email()}
`;
    fs.writeFileSync(filePath, fileContent.trim());
}
function generateNonSensitiveTxt(outputDir, fileName) {
    const filePath = path.join(outputDir, fileName);
    const fileContent = `
Favorite Color: ${faker.color.human()}
Hobby: ${faker.word.noun()}
Quote: "${faker.word.words()}"
`;
    fs.writeFileSync(filePath, fileContent.trim());
}
function generateSensitivePdf(outputDir, fileName) {
    const filePath = path.join(outputDir, fileName);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(filePath));
    
    doc.fontSize(12).text(`Name: ${faker.person.fullName()}`);
    doc.text(`SSN: ${faker.string.numeric({ length: 9 })}`);
    doc.text(`Credit Card: ${faker.finance.creditCardNumber()}`);
    doc.text(`Email: ${faker.internet.email()}`);

    doc.end();
}
function generateNonSensitivePdf(outputDir, fileName) {
    const filePath = path.join(outputDir, fileName);
    const doc = new PDFDocument();

    doc.pipe(fs.createWriteStream(filePath));
    
    doc.fontSize(12).text(`Favorite Color: ${faker.color.human()}`);
    doc.text(`Hobby: ${faker.word.noun()}`);
    doc.text(`Quote: "${faker.word.words()}"`);

    doc.end();
}

function generateFakeFiles(numSensitiveFiles = 5, numNonsensitiveFiles = 5, outputDir='test-data') {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < numSensitiveFiles; i++) {
        generateSensitiveTxt(outputDir, `sensitive-${i+1}.txt`);
        generateNonSensitiveTxt(outputDir, `nonsensitive-${i+1}.txt`);
        generateSensitivePdf(outputDir, `sensitive-${i+1}.pdf`);
        generateNonSensitivePdf(outputDir, `nonsensitive-${i+1}.pdf`);
    }
}

generateFakeFiles();
