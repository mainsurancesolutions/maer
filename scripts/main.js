const {app, BrowserWindow, BrowserView, dialog, shell} = require('electron')
const path = require('path')
const ipc = require('electron').ipcMain
let mainWindow
let loadedName = ""

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
		defaultPath: loadedName,
		filters:{extensions: 'maer'}
	}, (path) =>{
		if(path !== undefined){
			//No need to add the .maer extension if it already has it
			if(path.substring(path.lastIndexOf(".")) !== ".maer")
				path += ".maer"
			mainWindow.webContents.send('savePath', path)
		}
	})
})

ipc.on('load', (event, arg) =>{
	dialog.showOpenDialog(mainWindow, {
		filters:{extension: 'maer'},
		properties: ['openfile']
	}, (file) =>{
		if(file !== undefined){
			mainWindow.webContents.send('loadFile', file[0])
			//Store the filename of the loaded file
			loadedName = file[0]
		}
	})
})

ipc.on('edit', (event, arg) =>{
	shell.openItem(arg)
})