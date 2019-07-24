const electron = require('electron')
const {app, BrowserWindow, BrowserView, dialog, shell} = electron
const path = require('path')
const ipc = require('electron').ipcMain
let mainWindow
let defPage
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
	//Account for any case which could change the position
	mainWindow.on('maximize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.on('unmaximize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.on('resize', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	mainWindow.maximize()
	//When the main window is moved, send a signal to let it know its position changed
	mainWindow.on('move', (event, arg) =>{
		mainWindow.webContents.send('position', mainWindow.getPosition())
	})
	
}

ipc.on('getPos', (event, arg) =>{
	mainWindow.webContents.send('position', mainWindow.getPosition())
})

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

//Open definitions window
//arg is the allDefinitions array from mainWindow.js
ipc.on('definitions', (event, arg) =>{
	defPage = new BrowserWindow({
		parent: mainWindow,
		webPreferences: {
        	nodeIntegration: true
        },
        show: false,
        frame: false
	})
	defPage.webContents.send('position', defPage.getPosition())
	defPage.on('move', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('maximize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('unmaximize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.on('resize', (event, arg) =>{
		defPage.webContents.send('position', defPage.getPosition())
	})
	defPage.loadFile('definitions.html')
	defPage.removeMenu()
	defPage.openDevTools()
	defPage.once('ready-to-show', () =>{
		defPage.send('loadDefinitions', arg)
		defPage.show()
	})
})

ipc.on('closeDef', (event, arg) =>{
	defPage.close()
})

ipc.on('maximizeDef', (event, arg) =>{
	if(defPage.isMaximized()){
		defPage.unmaximize()
	} else{
		defPage.maximize()
	}
})

ipc.on('minimizeDef', (event, arg) =>{
	defPage.minimize()
})

//When a section number is hovered in the definitions doc, send that to the main page
//to get the text in the section, then send that text back to the definitions page to render
ipc.on('getSection', (event, arg) =>{
	mainWindow.send('getSection', arg)
})
ipc.on('sendSection', (event, arg) =>{
	defPage.webContents.send('sendSection', arg)
})
ipc.on('re-hover', (event, arg) =>{
	defPage.webContents.send('re-hover', arg)
})