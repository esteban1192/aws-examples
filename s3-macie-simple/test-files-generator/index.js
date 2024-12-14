import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';

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

function generateFakeFiles(numSensitiveFiles = 5, numNonsensitiveFiles = 5, outputDir='test-data') {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < numSensitiveFiles; i++) {
        generateSensitiveTxt(outputDir, `sensitive-${i+1}.txt`);
        generateNonSensitiveTxt(outputDir, `nonsensitive-${i+1}.txt`);
    }
}

generateFakeFiles();
