const ipc = require('electron').ipcRenderer
let addWindowButton = document.getElementById('addWindow')

addWindowButton.addEventListener('click', () => {
	ipc.send('addWindow')
})