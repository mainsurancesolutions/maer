const ipc = require('electron').ipcRenderer;
let addWindowButton = document.getElementById('addWindow');

console.log('online');
console.log(addWindowButton.id);
addWindowButton.addEventListener('click', () => {
	ipc.send('addWindow');
	document.getElementById('addWindow').innerHTML = ('clicked');
})