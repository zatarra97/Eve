#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Funzione per leggere il package.json
function readPackageJson() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageContent = fs.readFileSync(packagePath, 'utf8');
  return JSON.parse(packageContent);
}

// Funzione per scrivere il package.json
function writePackageJson(packageData) {
  const packagePath = path.join(process.cwd(), 'package.json');
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
}

// Funzione per aggiornare la versione
function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Tipo di versione non valido: ${type}`);
  }
}

// Funzione per chiedere input all'utente
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Funzione per eseguire comandi git
function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (error) {
    console.error(`Errore nell'esecuzione del comando git: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Funzione principale
async function main() {
  const versionType = process.argv[2];
  let description = process.argv[3] || '';

  if (!versionType || !['major', 'minor', 'patch'].includes(versionType)) {
    console.error('Uso: node version-bump.js <major|minor|patch> [descrizione]');
    console.error('');
    console.error('Esempi:');
    console.error('  node scripts/version-bump.js patch');
    console.error('  node scripts/version-bump.js minor "Aggiunta nuova funzionalità di ricerca"');
    console.error('  node scripts/version-bump.js major "Breaking change: nuova API"');
    console.error('');
    console.error('Se non fornisci una descrizione, ti verrà chiesta interattivamente.');
    process.exit(1);
  }

  // Se non è stata fornita una descrizione, chiedila interattivamente
  if (!description) {
    console.log(`\n📝 Aggiornamento versione: ${versionType.toUpperCase()}`);
    description = await askQuestion('Inserisci una descrizione per il commit e il tag (opzionale): ');
  }

  try {
    // Leggi il package.json corrente
    const packageData = readPackageJson();
    const currentVersion = packageData.version;

    console.log(`Versione corrente: ${currentVersion}`);

    // Calcola la nuova versione
    const newVersion = bumpVersion(currentVersion, versionType);
    console.log(`Nuova versione: ${newVersion}`);

    // Aggiorna il package.json
    packageData.version = newVersion;
    writePackageJson(packageData);
    console.log('✅ Package.json aggiornato');

    // Verifica che siamo in un repository git
    try {
      runGitCommand('git rev-parse --git-dir');
    } catch (error) {
      console.error('❌ Non sei in un repository git');
      process.exit(1);
    }

    // Aggiungi le modifiche al package.json
    runGitCommand('git add .');
    //console.log('✅ Modifiche aggiunte al git staging area');

    // Crea il commit
    const commitMessage = description 
      ? description
      : `chore: bump version to ${newVersion}`;
    runGitCommand(`git commit -m "${commitMessage}"`);
    console.log('✅ Commit creato');

    // Crea il tag
    const tagMessage = description 
      ? description
      : `Release version ${newVersion}`;
    runGitCommand(`git tag -a v${newVersion} -m "${tagMessage}"`);
    console.log('✅ Tag creato');

    // Push del commit e del tag
    runGitCommand('git push');
    runGitCommand('git push --tags');
    console.log('✅ Push completato');

    console.log(`\n🎉 Versione aggiornata con successo a ${newVersion}!`);

  } catch (error) {
    console.error('❌ Errore durante l\'aggiornamento della versione:', error.message);
    process.exit(1);
  }
}

// Esegui lo script
main(); 