const {app, BrowserWindow, BrowserView, dialog, shell} = require('electron')
const {PythonShell} = require('python-shell')
const path = require('path')
const ipc = require('electron').ipcMain
let mainWindow

app.on('ready', createMainWindow);

app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
	if(process.platform !== 'darwin'){
		app.quit()
	}
});

function createMainWindow(){
	mainWindow = new BrowserWindow({
		icon: 'C:/MA/ElectronTest/images/icon.ico',
		frame: false,
		webPreferences: {
        	nodeIntegration: true
        },
        'minHeight': 480,
        'minWidth': 640
	});
	mainWindow.loadFile('index.html')
	//mainWindow.openDevTools()
	mainWindow.maximize()
}

ipc.on('close', (event, arg) =>{
	if(process.platform !== 'darwin'){
		app.quit()
	}
	else{
		win.hide()
	}
})

ipc.on('maximize', (event, arg) =>{
	if(mainWindow.isMaximized()){
		mainWindow.unmaximize()
	} else{
		mainWindow.maximize()
	}
})

ipc.on('minimize', (event, arg) =>{
	mainWindow.minimize()
})

ipc.on('restart', (event, arg) =>{
	mainWindow.reload()
})

ipc.on('save', (event, arg) =>{
	dialog.showSaveDialog(mainWindow, {
		filters:{extensions: 'maer'}
	}, (path) =>{
		mainWindow.webContents.send('savePath', path + ".maer")
	})
})

ipc.on('load', (event, arg) =>{
	dialog.showOpenDialog(mainWindow, {
		filters:{extension: 'maer'},
		properties: ['openfile']
	}, (file) =>{
		if(file !== undefined)
			mainWindow.webContents.send('loadFile', file[0])
	})
})

ipc.on('edit', (event, arg) =>{
	shell.openItem(arg)
})

/*
//Python code, not gotten to backend linking yet
PythonShell.run('test.py', null, function(err,results) {
	if(err) throw err
	console.log('results:', results)
});
*/