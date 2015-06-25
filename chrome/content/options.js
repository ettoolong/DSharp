const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const DB_FILE_NAME = "ettdsharp.sqlite";
const DB_TABLE_NAME = "user_define_text";
const DB_TABLE_NAME_V2 = "user_define_text_v2";
const DB_TABLE_FIELD = "sitename TEXT, filter TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";
const DB_TABLE_FIELD_V2 = "sitename TEXT, filter TEXT, replacef TEXT, replaceto TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";

function EttDSharpOptions() {
  this.site = [];
  this.valueBool = ['autoResult'];
  this.valueInte = ['action'];
  this.valueComp = [];
  this.values = [];
}

EttDSharpOptions.prototype = {
  dirSvc_ : Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,
  prefs : Components.classes["@mozilla.org/preferences-service;1"]
              .getService(Components.interfaces.nsIPrefService)
              .getBranch("extensions.dsharp.options."),

  getPrefBool: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    this.values[elementId] = this.prefs.getBoolPref(prefName);
  },

  setPrefBool: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    this.prefs.setBoolPref(prefName, this.values[elementId]);
  },

  getPrefInte: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    this.values[elementId] = this.prefs.getIntPref(prefName);
  },

  setPrefInte: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    this.prefs.setIntPref(prefName, this.values[elementId]);
  },

  getPrefComp: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    this.values[elementId] = this.prefs.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
  },

  setPrefComp: function(elementId, prefName) {
    if(!prefName) prefName = elementId;
    var nsIString = Components.classes["@mozilla.org/supports-string;1"]
                              .createInstance(Components.interfaces.nsISupportsString);
    nsIString.data = this.values[elementId];
    this.prefs.setComplexValue(prefName, Components.interfaces.nsISupportsString, nsIString);
  },

  getUiBool: function(elementId) {
    this.values[elementId] = document.getElementById(elementId).checked;
  },

  setUiBool: function(elementId) {
    document.getElementById(elementId).checked = this.values[elementId];
  },

  getUiInte: function(elementId) {
    this.values[elementId] = document.getElementById(elementId).value;
  },

  setUiInte: function(elementId) {
    document.getElementById(elementId).value = this.values[elementId];
  },

  getUiComp: function(elementId) {
    this.values[elementId] = document.getElementById(elementId).value;
  },

  setUiComp: function(elementId) {
    document.getElementById(elementId).value = this.values[elementId];
  },

  getDBConnection: function (aForceOpen) {
    if (!aForceOpen && !this.dbFile_.exists())
      return null;
    if (!this.dbConn_ || !this.dbConn_.connectionReady) {
      var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
      this.dbConn_ = dbSvc.openDatabase(this.dbFile_);
    }
    return this.dbConn_;
  },

  getTableVersion: function(dbConn) {
    if(dbConn.tableExists(DB_TABLE_NAME))
      return 1;
    else if(dbConn.tableExists(DB_TABLE_NAME_V2))
      return 2;
    return 0;
  },

  load: function() {
    this.dbFile_ = this.dirSvc_.get("ProfD", Ci.nsIFile);
    this.dbFile_.append(DB_FILE_NAME);
    var dbConn = this.getDBConnection(false);
    if (!dbConn || this.getTableVersion(dbConn)!=2 )
      return false;

    var list = document.getElementById('treeSiteList');
    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME_V2);
    try {
      while (stmt.executeStep())
      {
        //var idx   = stmt.getInt32(0);
        var sitename  = stmt.getUTF8String(0);
        var filter    = stmt.getUTF8String(1);
        var replacef  = stmt.getUTF8String(2);
        var replaceto = stmt.getUTF8String(3);
        var addr      = stmt.getUTF8String(4);
        var icon      = stmt.getUTF8String(5);
        var charcase  = stmt.getInt32(6);
        var enabled   = (stmt.getInt32(7)!=0);
        var reserve   = stmt.getInt32(8);
        var newSite = new EttDSharpSite(sitename, filter, replacef, replaceto, addr, icon, charcase, enabled, reserve);
        this.site.push(newSite);
        this.addSiteToList(list, sitename, enabled, false);
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
    if(list.view.rowCount)
    {
      //list.selectedIndex = 0;
      list.view.selection.select(0);
      document.getElementById('btnModify').disabled = false;
      document.getElementById('btnDel').disabled = false;
    }
    //
    for(var i in this.valueBool){
      try{
        this.getPrefBool(this.valueBool[i]);
      }
      catch(e){
        //read this pref from default and save this value right now !
        var item = document.getElementById(this.valueBool[i]);
        if(item)
          this.values[this.valueBool[i]] = (item.getAttribute('dsharpDefaultValue')=='true');
        this.setPrefBool(this.valueBool[i]);
      }
    }
    for(var i in this.valueInte){
      try{
        this.getPrefInte(this.valueInte[i]);
      }
      catch(e){
        //read this pref from default...
        var item = document.getElementById(this.valueInte[i]);
        if(item)
          this.values[this.valueInte[i]] = item.getAttribute('dsharpDefaultValue');
        this.setPrefInte(this.valueInte[i]);
      }
    }
    for(var i in this.valueComp){
      try{
        this.getPrefComp(this.valueComp[i]);
      }
      catch(e){
        //read this pref from default...
        var item = document.getElementById(this.valueComp[i]);
        if(item)
          this.values[this.valueComp[i]] = item.getAttribute('dsharpDefaultValue');
        this.setPrefComp(this.valueComp[i]);
      }
    }

    for(var i in this.valueBool){
      this.setUiBool(this.valueBool[i]);
    }
    for(var i in this.valueInte){
      this.setUiInte(this.valueInte[i]);
    }
    for(var i in this.valueComp){
      this.setUiComp(this.valueComp[i]);
    }
    //
    return true;
  },

  save: function() {
    var dbConn = this.getDBConnection(true);
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+DB_TABLE_NAME_V2);
    dbConn.createTable(DB_TABLE_NAME_V2, DB_TABLE_FIELD_V2);
    dbConn.beginTransaction();

    for(var i in this.site){
      var stmt = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?,?)");

      stmt.bindUTF8StringParameter(0, this.site[i].sitename);
      stmt.bindUTF8StringParameter(1, this.site[i].filter);
      stmt.bindUTF8StringParameter(2, this.site[i].replacef);
      stmt.bindUTF8StringParameter(3, this.site[i].replaceto);
      stmt.bindUTF8StringParameter(4, this.site[i].addr);
      stmt.bindUTF8StringParameter(5, this.site[i].icon);
      stmt.bindInt32Parameter(6, this.site[i].charcase);
      stmt.bindInt32Parameter(7, this.site[i].enabled ? 1 : 0);
      stmt.bindInt32Parameter(8, this.site[i].reserve);
      try {
        stmt.execute();
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    dbConn.commitTransaction();

    //
    for(var i in this.valueBool){
      this.getUiBool(this.valueBool[i]);
    }
    for(var i in this.valueInte){
      this.getUiInte(this.valueInte[i]);
    }
    for(var i in this.valueComp){
      this.getUiComp(this.valueComp[i]);
    }

    for(var i in this.valueBool){
      this.setPrefBool(this.valueBool[i]);
    }
    for(var i in this.valueInte){
      this.setPrefInte(this.valueInte[i]);
    }
    for(var i in this.valueComp){
      this.setPrefComp(this.valueComp[i]);
    }
    //

    var t2 = new Date();
    this.prefs.setIntPref("updateSetting", t2.getTime());
  },

  finish: function() {
    if(this.dbConn_)
    {
      this.dbConn_.close();
      this.dbConn_ = null;
    }
  },

  addNewSiteSetting: function() {
    const EMURL = "chrome://dsharp/content/editSiteDlg.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
    var retVals = { exec: false, sitename: null, filter: null, replacef: null, replaceto: null, addr: null, icon: null, charcase: 0, reserve: 0};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
    if(retVals.exec)
    {
      var list = document.getElementById('treeSiteList');
      var newSite = new EttDSharpSite(retVals.sitename, retVals.filter, retVals.replacef, retVals.replaceto, retVals.addr, retVals.icon, retVals.charcase, true, retVals.reserve);
      this.site.push(newSite);
      this.addSiteToList(list, retVals.sitename, true, true);
      // add to database...
      if(list.view.rowCount==1)
        list.view.selection.select(0);
      this.updateButtonState();
      return true;
    }
    else
    {
    }
    return false;
  },

  delSelSiteSetting: function() {
    var strBundle = document.getElementById("dsharp-strbundle");
    var title = strBundle.getString('delsitetitle');
    var message = strBundle.getString('delsiteconfirm');
    var promptSvc = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    if (!promptSvc.confirm(window, title, message)) return false;

    var list = document.getElementById('treeSiteList');
    var list2 = document.getElementById('siteItems');
    var idx = list.currentIndex;
    var idx2 = 0;
    //list.removeItemAt(list.getIndexOfItem(list.selectedItems[0]));
    list2.removeChild(list2.childNodes[idx]);

    var temp = [];
    while(this.site.length){
      var setting = this.site.shift();
      {
        if(idx2 != idx)
          temp.push(setting);
        ++idx2;
      }
    }

    while(temp.length){
      this.site.push(temp.shift());
    }

    if(list.view.rowCount)
    {
      var newIdx = idx;
      if(list.view.rowCount==newIdx)
        newIdx = list.itemCount-1;
      list.view.selection.select(newIdx);
      //list.selectedIndex = newIdx;
    }
    this.updateButtonState();
    return true;
  },

  modifySelSiteSetting: function() {

    var list = document.getElementById('treeSiteList');
    var list2 = document.getElementById('siteItems');
    var idx = list.currentIndex;
    var setting = this.site[idx];

    const EMURL = "chrome://dsharp/content/editSiteDlg.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=yes, centerscreen";
    var retVals = {exec: false, sitename: setting.sitename, filter: setting.filter, replacef: setting.replacef, replaceto: setting.replaceto, addr: setting.addr, icon: setting.icon, charcase: setting.charcase, reserve: setting.reserve};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
    if(retVals.exec)
    {
      this.site[idx].sitename = retVals.sitename;
      this.site[idx].filter = retVals.filter;
      this.site[idx].replacef = retVals.replacef;
      this.site[idx].replaceto = retVals.replaceto;
      this.site[idx].addr = retVals.addr;
      this.site[idx].icon = retVals.icon;
      this.site[idx].charcase = retVals.charcase;
      this.site[idx].reserve = retVals.reserve;
      this.modifyListSite(list2.childNodes[idx], retVals.sitename);
      return true;
    }
    return false;

  },

  updateCheckBoxState: function(item) {
    var list = document.getElementById('treeSiteList');
    var list2 = document.getElementById('siteItems');
    var count = list.view.rowCount;

    for (var i=0; i<count; i++) {
      var enabled = list.view.getCellValue(i, list.columns['columnEnabled'])=="true" ? true : false;
      this.site[i].enabled = enabled;
    }
    //this.updateButtonState();
    //var idx = list.currentIndex;
    //alert(idx);

  },

  importSiteSetting: function() {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, null, nsIFilePicker.modeOpen);
    fp.appendFilter("SQLite", "*.sqlite");
    if (fp.show() == fp.returnCancel || !fp.file) return false;
    if(!fp.file.exists()) return false;

    var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
    var dbConn = dbSvc.openDatabase(fp.file);

    var list = document.getElementById('treeSiteList');

    var dbVersion = this.getTableVersion(dbConn);

    if(dbVersion==0)
      return true;
    else if(dbVersion==1)
    {
      var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME);
      try {
        while (stmt.executeStep())
        {
          var sitename = stmt.getUTF8String(0);
          var filter   = stmt.getUTF8String(1);
          var addr     = stmt.getUTF8String(2);
          var icon     = stmt.getUTF8String(3);
          var charcase  = stmt.getInt32(4);
          var enabled  = (stmt.getInt32(5)!=0);
          var reserve  = stmt.getInt32(6);
          var newSite = new EttDSharpSite(sitename, filter, '', '', addr, icon, charcase, enabled, reserve);
          this.site.push(newSite);
          this.addSiteToList(list, sitename, enabled, false);
        }
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    else if(dbVersion==2)
    {
      var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME_V2);
      try {
        while (stmt.executeStep())
        {
          var sitename  = stmt.getUTF8String(0);
          var filter    = stmt.getUTF8String(1);
          var replacef  = stmt.getUTF8String(2);
          var replaceto = stmt.getUTF8String(3);
          var addr      = stmt.getUTF8String(4);
          var icon      = stmt.getUTF8String(5);
          var charcase  = stmt.getInt32(6);
          var enabled   = (stmt.getInt32(7)!=0);
          var reserve   = stmt.getInt32(8);
          var newSite = new EttDSharpSite(sitename, filter, replacef, replaceto, addr, icon, charcase, enabled, reserve);
          this.site.push(newSite);
          this.addSiteToList(list, sitename, enabled, false);
        }
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }

    if(dbConn )
    {
      dbConn.close();
      dbConn = null;
    }
    if(list.view.rowCount)
      list.view.selection.select(0);
    this.updateButtonState();
    return true;
  },

  exportSiteSetting: function() {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, null, nsIFilePicker.modeSave);
    fp.appendFilter("SQLite", "*.sqlite");
    fp.defaultString = "DSharp_Backup.sqlite";
    if (fp.show() == fp.returnCancel || !fp.file) return;

    var file = fp.file.QueryInterface(Ci.nsIFile);
    //if file already exists delete it.
    if(file.exists())
      file.remove(true);
    //

    var dbSvc = Cc["@mozilla.org/storage/service;1"].getService(Ci.mozIStorageService);
    var dbConn = dbSvc.openDatabase(file);

    if (!dbConn.tableExists(DB_TABLE_NAME_V2))
      dbConn.createTable(DB_TABLE_NAME_V2, DB_TABLE_FIELD_V2);

    dbConn.beginTransaction();

    for(var i in this.site){
      var stmt = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?,?)");

      stmt.bindUTF8StringParameter(0, this.site[i].sitename);
      stmt.bindUTF8StringParameter(1, this.site[i].filter);
      stmt.bindUTF8StringParameter(2, this.site[i].replacef);
      stmt.bindUTF8StringParameter(3, this.site[i].replaceto);
      stmt.bindUTF8StringParameter(4, this.site[i].addr);
      stmt.bindUTF8StringParameter(5, this.site[i].icon);
      stmt.bindInt32Parameter(6, this.site[i].charcase);
      stmt.bindInt32Parameter(7, this.site[i].enabled ? 1 : 0);
      stmt.bindInt32Parameter(8, this.site[i].reserve);
      try {
        stmt.execute();
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    dbConn.commitTransaction();

    if(dbConn )
    {
      dbConn.close();
      dbConn = null;
    }
  },

  addSiteToList: function(list, sitename, enabled, setVisible) {
    var list2 = document.getElementById('siteItems');
    var item = document.createElement('treeitem');
    var row = document.createElement('treerow');
    var c1 = document.createElement('treecell');
    var c2 = document.createElement('treecell');
    c1.setAttribute('value', enabled);
    c2.setAttribute('label', sitename);
    row.appendChild(c1);
    row.appendChild(c2);
    item.appendChild(row);
    list2.appendChild(item);
    if(setVisible)
    {
      var idx = list2.childNodes.length-1;
      list.view.selection.select(idx);
      list.boxObject.ensureRowIsVisible(idx);
    }
    list.focus();
  },

  modifyListSite: function(item, sitename) {
    item.childNodes[0].childNodes[1].setAttribute('label', sitename);
  },

  siteSettingMoveUp: function() {
      var list = document.getElementById('treeSiteList');
      var idx = list.currentIndex;
      if(idx==0)
        return false;
      this.siteSettingSwap(idx, idx-1);
      this.listSiteSwap(idx, idx-1);
      list.view.selection.select(idx-1);
      list.boxObject.ensureRowIsVisible(idx-1);
      this.updateButtonState();
      return true;
  },

  siteSettingMoveDown: function() {
      var list = document.getElementById('treeSiteList');
      var idx = list.currentIndex;
      if(idx>=list.view.rowCount)
        return false;
      this.siteSettingSwap(idx, idx+1);
      this.listSiteSwap(idx, idx+1);
      list.view.selection.select(idx+1);
      list.boxObject.ensureRowIsVisible(idx+1);
      this.updateButtonState();
      return true;
  },

  siteSettingSwap: function(idx1, idx2) {
    var tempSite = this.site[idx1];
    this.site[idx1] = this.site[idx2];
    this.site[idx2] = tempSite;
  },

  listSiteSwap: function(idx1, idx2) {
    var list = document.getElementById('treeSiteList');
    var list2 = document.getElementById('siteItems');
    var count = list.view.rowCount;

    var enabled1 = list2.childNodes[idx1].childNodes[0].childNodes[0].getAttribute('value');
    var sitename1 = list2.childNodes[idx1].childNodes[0].childNodes[1].getAttribute('label');
    var enabled2 = list2.childNodes[idx2].childNodes[0].childNodes[0].getAttribute('value');
    var sitename2 = list2.childNodes[idx2].childNodes[0].childNodes[1].getAttribute('label');

    list2.childNodes[idx1].childNodes[0].childNodes[0].setAttribute('value', enabled2);
    list2.childNodes[idx1].childNodes[0].childNodes[1].setAttribute('label', sitename2);
    list2.childNodes[idx2].childNodes[0].childNodes[0].setAttribute('value', enabled1);
    list2.childNodes[idx2].childNodes[0].childNodes[1].setAttribute('label', sitename1);
  },

  updateButtonState: function() {
    var list = document.getElementById('treeSiteList');
    var btnMoveUp = document.getElementById('btnMoveUp');
    var btnMoveDown = document.getElementById('btnMoveDown');
    var btnDel = document.getElementById('btnDel');
    var btnModify = document.getElementById('btnModify');
    var btnExport = document.getElementById('btnExport');

    //move up/down - start
    var idx = list.currentIndex;
    if(idx==0 || list.view.rowCount<2)
      btnMoveUp.disabled = true;
    else
      btnMoveUp.disabled = false;

    if(idx==list.view.rowCount-1 || list.view.rowCount<2)
      btnMoveDown.disabled = true;
    else
      btnMoveDown.disabled = false;
    //move up/down - end

    //del - start
    btnDel.disabled = !(list.view.rowCount);
    //del - end

    //modify - start
    btnModify.disabled = !(list.view.rowCount);
    //modify - end

    //modify - start
    btnExport.disabled = !(list.view.rowCount);
    //modify - end
  }

}

var options = null;
var instantApply = false;

function load() {
var prefs = Components.classes["@mozilla.org/preferences-service;1"]
             .getService(Components.interfaces.nsIPrefService).getBranch('browser.preferences.');
  instantApply = prefs.getBoolPref('instantApply');
  options = new EttDSharpOptions();
  options.load();
  options.updateButtonState();
}

function save() {
  options.save();
  options.finish();
}

function cancel() {
  options.finish();
}

function addNewSiteSetting() {
  if(options.addNewSiteSetting())
    if(instantApply)
      options.save();
}

function delSelSiteSetting() {
  if(options.delSelSiteSetting())
    if(instantApply)
      options.save();
}

function modifySelSiteSetting(event) {
  if(event)
  {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('treeSiteList').stopEditing(true);
  }
  if(options.modifySelSiteSetting())
    if(instantApply)
      options.save();
}

function updateCheckBoxState(event) {
  if(options.updateCheckBoxState(event.target))
    if(instantApply)
      options.save();
}

function importSiteSetting() {
  if(options.importSiteSetting())
    if(instantApply)
      options.save();
}

function exportSiteSetting() {
  options.exportSiteSetting();
}

function updateDelButtonStatus(event) {
  var btnDel = document.getElementById('btnDel');
  var list = document.getElementById('treeSiteList');
  btnDel.disabled = (list.view.selection.count < 1);
  options.updateButtonState();
}

function siteSettingMoveUp() {
  if(options.siteSettingMoveUp())
    if(instantApply)
      options.save();
}

function siteSettingMoveDown() {
  if(options.siteSettingMoveDown())
    if(instantApply)
      options.save();
}