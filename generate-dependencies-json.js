#!/usr/bin/env node

var fs = require('fs'),
  path = require('path');

const node_modules_dir = path.resolve(process.cwd(), 'node_modules');

const getStat = path => {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stat) => {
      if (err) { reject(err); return; }
      resolve({ path, stat });
    })
  })
}

const readdir = (path) => {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, items) => {
      if (err) { reject(err); return; }
      resolve({ path, items });
    })
  })
}

const getPotentialModules = dirObject => {
  return new Promise((resolve, reject) => {
    Promise.all(
      dirObject.items.map(f => {
        return getStat(path.resolve(dirObject.path, f));
      })
    ).then(res => {
      resolve(res.filter(f => f.stat.isDirectory()));
    }).catch(err => {
      reject(err);
    })
  })
}

const checkforPackageJson = _path => {
  try {
    _path = path.resolve(_path, 'package.json');
    fs.accessSync(_path, fs.constants.R_OK);
    return true;
  } catch (e) {
    return false;
  }
}

const scanModulesforPackageFile = module_list => {
  return module_list.filter(module => {
    return checkforPackageJson(module.path);
  })
}

const findNonModuleDirs = dirs => {
  return dirs.filter(module => {
    return !checkforPackageJson(module.path);
  })
}

const flatAllModules = async (listOfPotentialModules) => {
  let definite_module = [];
  for (let i = 0; i < listOfPotentialModules.length; i++) {
    const dir = listOfPotentialModules[i];
    if (checkforPackageJson(dir.path)) {
      definite_module.push(dir.path);
    } else {
      const modules = await startScanning(dir.path)
      definite_module = definite_module.concat(modules);
    }
  }
  return definite_module;
}

const startScanning = async (node_modules_dir) => {
  const dir_object = await readdir(node_modules_dir);
  const list_potential_modules = await getPotentialModules(dir_object);
  const all_modules = await flatAllModules(list_potential_modules);
  return all_modules;
}

const loadFile = file => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, res) => {
      if (err) reject(err, "error while reading file");
      try {
        const { name, version } = JSON.parse(res);
        resolve({ name, version });
      } catch (e) {
        console.log(file, res);
        reject(err, "error while reading file");
      }
    })
  });
}

loadFiles = files => {
  Promise.all(files.map(file => {
    return loadFile(`${file}/package.json`);
  })).then(results => {
    const fileObj = results.reduce((accum, res) => ({ ...accum, ...{ [res.name]: res.version } }), {});
    console.log(fileObj);
    fs.writeFile('package-dependencies.json', JSON.stringify(fileObj), (err, success) => {
      if (err) throw new Error('Error while saving file.');
      console.log('File generated successfullly');
    });
  });
}

startScanning(node_modules_dir).then(res => {
  loadFiles([...res]);
}).catch(e => {
  console.log("Error!!! Can't find node_modules", e);
});
