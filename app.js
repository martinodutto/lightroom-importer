const fs = require('fs-extra');
const env = require('./env');

const sourceDir = process.argv[2];
if (!sourceDir) {
    console.error('Please provide at least the path of the files to be copied');
    process.exit(1);
}
if (!fs.existsSync(sourceDir)) {
    console.error('Unexisting source directory specified. Please correct it before retrying');
    process.exit(2);
}
if (!fs.lstatSync(sourceDir).isDirectory()) {
    console.error(`The provided source path "${sourceDir}" is not a directory`);
    process.exit(3);
}
console.info(`Looking for files to copy from source directory "${sourceDir}"`);

const destDir = process.argv[3] || env.DEFAULT_DEST_PATH;
fs.ensureDirSync(destDir);
console.info(`Targeting directory "${destDir}"`);

const rangeFrom = Number.parseInt(process.argv[4]) || 0;
const rangeTo = Number.parseInt(process.argv[5]);
if (!rangeTo || Number.isNaN(rangeTo)) {
    console.error(`Invalid upper bound: "${process.argv[5]}"`);
    process.exit(1);
}

const picturesSuffix = process.argv[6] && process.argv[6].toUpperCase();
const picturesPrefix = process.argv[7] || env.DEFAULT_PICTURES_PREFIX;

console.info(`Ranging from ${picturesPrefix}${rangeFrom} to ${picturesPrefix}${rangeTo} while looking for the pictures to import. Suffix: ${picturesSuffix || 'any'}`);

copyFiles();

function startsWithTheProvidedPrefix(file) {
    return file.startsWith(picturesPrefix);
}

function endsWithTheProvidedSuffix(file) {
    return !picturesSuffix || file.toUpperCase().endsWith(picturesSuffix);
}

function extractProgressive(file) {
    const dot = file.indexOf('.') || file.length;
    try {
        return Number.parseInt(file.substring(picturesPrefix.length, dot));
    } catch (e) {
        console.warn(`Unable to find an integer progressive for ${file}. Skipping`);
        return false;
    }
}

function copyFiles() {
    const startTime = Date.now();
    fs.copy(sourceDir, destDir, {
        overwrite: false,
        filter: (src) => {
            if (fs.lstatSync(src).isDirectory()) {
                // any directory must be accessed
                return true;
            } else {
                const fileName = src.split('/').pop();
                if (startsWithTheProvidedPrefix(fileName) && endsWithTheProvidedSuffix(fileName)) {
                    const prog = extractProgressive(fileName);
                    return prog && prog >= rangeFrom && prog <= rangeTo;
                }
                return false;
            }
        }
    })
        .then(() => {
            flattenStructure(destDir);
            console.info(`Copy finished! Elapsed: ${(Date.now() - startTime)/1000} s`);
        })
        .catch(err => {
            console.error(`An error occurred while copying the files from "${sourceDir}" to "${destDir}": ${err}`);
        });
}

/**
 * Moves every file in every subfolder of the target directory to the latter.
 *
 * @param parentDir Current subfolder of the target directory.
 */
function flattenStructure(parentDir) {
    const files = fs.readdirSync(parentDir);
    files.forEach(f => {
        const fullFilePath = `${parentDir}/${f}`;
        if (!fs.lstatSync(fullFilePath).isDirectory()) {
            // files already in the root dir must stay there
            if (parentDir !== destDir) {
                fs.renameSync(fullFilePath, `${destDir}/${f}`);
            }
        } else {
            flattenStructure(fullFilePath);
            // at this point, the directory should be empty, so it's safe to delete it
            fs.rmdirSync(fullFilePath);
        }
    });
}
