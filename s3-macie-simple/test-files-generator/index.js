import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';

function generateFakeFiles(numFiles = 10, outputDir = './test-data') {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < numFiles; i++) {
        const isSensitive = Math.random() > 0.5; // Randomly decide if the file contains sensitive data
        const fileName = `${isSensitive ? 'sensitive' : 'nonsensitive'}_${i + 1}.txt`;
        const filePath = path.join(outputDir, fileName);

        let fileContent;
        if (isSensitive) {
            // Generate fake sensitive data
            fileContent = `
Name: ${faker.person.fullName()}
SSN: ${faker.string.numeric({ length: 9 })}
Credit Card: ${faker.finance.creditCardNumber()}
Email: ${faker.internet.email()}
`;
        } else {
            // Generate fake non-sensitive data
            fileContent = `
Favorite Color: ${faker.color.human()}
Hobby: ${faker.word.noun()}
Quote: "${faker.word.words()}"
`;
        }

        // Write the content to a file
        fs.writeFileSync(filePath, fileContent.trim());
    }

    console.log(`Generated ${numFiles} files in directory: ${outputDir}`);
}

// Run the function
generateFakeFiles();
