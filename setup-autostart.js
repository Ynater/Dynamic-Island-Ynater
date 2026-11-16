const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Путь к текущему файлу main.js
const mainJsPath = path.join(__dirname, 'main.js').replace(/\\/g, '\\\\');

// Команда для создания задачи автозапуска в Windows Task Scheduler
const taskName = 'IsletAutoStart';
const command = `schtasks /create /tn "${taskName}" /tr "node \\"${mainJsPath}\\"" /sc onlogon /rl highest /f`;

try {
    // Удаляем старую задачу, если она есть
    execSync(`schtasks /delete /tn "${taskName}" /f`, { stdio: 'ignore' });
    
    // Создаём новую задачу
    execSync(command);
    
    console.log('✅ Автозапуск настроен! Капсула будет появляться при каждом входе в Windows.');
    console.log(`   Задача: ${taskName}`);
    console.log(`   Команда: node "${mainJsPath}"`);
} catch (err) {
    console.error('❌ Ошибка настройки автозапуска:');
    console.error(err.message);
    console.log('\n💡 Попробуй запустить VS Code от имени администратора и повтори команду.');
}