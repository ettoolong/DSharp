const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const DB_FILE_NAME = "ettdsharp.sqlite";
const DB_TABLE_NAME = "user_define_text";
const DB_TABLE_NAME_V2 = "user_define_text_v2";
//const DB_TABLE_FIELD = "sitename TEXT, filter TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";
//const DB_TABLE_FIELD_V2 = "sitename TEXT, filter TEXT, replacef TEXT, replaceto TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";

var DsharpList = {
  action_: 0,
  autoResult_: false,
  site_ : [],
  dirSvc_ : Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,

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
	
  loadSiteData: function () {
    this.site_ = [];
    this.dbFile_ = this.dirSvc_.get("ProfD", Ci.nsIFile);
    this.dbFile_.append(DB_FILE_NAME);
    var dbConn = this.getDBConnection(false);
    if (!dbConn || this.getTableVersion(dbConn)!=2 )//only use version 2
      return false;

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
        var charcase  = stmt.getUTF8String(6);
        var enabled   = (stmt.getInt32(7)!=0);
        var reserve   = stmt.getInt32(8);
        var newSite = new EttDSharpSite(sitename, filter, replacef, replaceto, addr, icon, charcase, enabled, reserve);
        this.site_.push(newSite);
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }
  },

  init: function () {
    this.loadSiteData();

    var retVals = window.arguments[0];
    var textbox = document.getElementById('TestText');
    textbox.value = retVals.selectedText;
    this.updateList();
    //update list...
    //
    return true;
  },

  updateList: function () {
    //
      var list = document.getElementById('SiteList');
      while(list.itemCount)
        list.removeItemAt(0);

      var str = document.getElementById('TestText').value;
      str = this.trim_both(str);
      for(var i = 0; i < this.site_.length; ++i)
      {
        if(this.site_[i].enabled)
        {
          //test filter...
          var regex = new RegExp(this.site_[i].filter, 'i');
          if(regex.test(str))
          {
            var splits = str.split(regex);
            if(splits.length>1)
            {
              var url;
              var keyword = splits[1];
              if(this.site_[i].replacef!='')
              {
                var regex2 = new RegExp(this.site_[i].replacef, '');
                keyword = keyword.replace(regex2, this.site_[i].replaceto);
              }
              if(this.site_[i].charcase==1)
                url = this.site_[i].addr + keyword.toUpperCase();
              else if(this.site_[i].charcase==2)
                url = this.site_[i].addr + keyword.toLowerCase();
              else //if(_this.site_[i].charcase==0)
                url = this.site_[i].addr + keyword;
              this.addListItem(this.site_[i].sitename, url);
            }
          }
        }
      }
      this.siteChanged();
  },

  siteChanged: function () {
      var list = document.getElementById('SiteList');
      var btn = document.getElementById('openSelectSite');
      if(list.selectedItems[0])
        btn.disabled = false;
      else
        btn.disabled = true;
  },

  trim_left: function(str) {
    var i;
    for(i=0;i<str.length;++i){
      if(str.charAt(i)!=" ") break;
    }
    str = str.substring(i,str.length);
    return str;
  },

  trim_right: function(str) {
    var i;
    for(i=str.length-1;i>=0;i--){
      if(str.charAt(i)!=" ") break;
    }
    str = str.substring(0,i+1);
    return str;
  },

  trim_both: function(str) {
    return this.trim_left(this.trim_right(str));
  },

  addListItem: function (sitename, url) {
    var siteList = document.getElementById('SiteList');

    var row = document.createElement('listitem');
    var cell = document.createElement('listcell');
    cell.setAttribute('label', sitename);
    row.appendChild(cell);

    cell = document.createElement('listcell');
    cell.setAttribute('label', url);
    row.appendChild(cell);

    siteList.appendChild(row);
  },

  onSelectDsharp: function () {
    var list = document.getElementById('SiteList');
    this.openUrl(list.currentItem.childNodes[1].getAttribute('label'));
  },

  openUrl: function(url) {
      var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
               .getService(Components.interfaces.nsIWindowMediator)
               .getMostRecentWindow("navigator:browser");
      if (win)
        win.gBrowser.loadOneTab(url, null, null, null, false, false);
      else
        window.open(url);
  },

  checkURL: function(aURL, aDoc, aFlags) {
    urlSecurityCheck(aURL, aDoc.nodePrincipal, aFlags);
  },

  onCloseClick: function () {
    window.close();
  },

  finish: function () {
  }

};
