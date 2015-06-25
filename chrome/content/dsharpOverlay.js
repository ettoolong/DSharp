const DB_FILE_NAME = "ettdsharp.sqlite";
const DB_TABLE_NAME = "user_define_text";
const DB_TABLE_NAME_V2 = "user_define_text_v2";
const DB_TABLE_FIELD = "sitename TEXT, filter TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";
const DB_TABLE_FIELD_V2 = "sitename TEXT, filter TEXT, replacef TEXT, replaceto TEXT, addr TEXT, icon TEXT, charcase INTEGER, enabled INTEGER, reserve INTEGER";

var EttDSharp = {
  action_: 0,
  autoResult_: false,
  site_ : [],
  dirSvc_ : Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties),
  dbFile_ : null,
  dbConn_ : null,
  DSharpVersion : "0.0.0",

  getDBFile: function () {
    if(!this.dbFile_)
    {
      this.dbFile_ = this.dirSvc_.get("ProfD", Components.interfaces.nsIFile);
      this.dbFile_.append(DB_FILE_NAME);
    }
    return this.dbFile_;
  },
  
  getDBConnection: function (aForceOpen) {
  	this.getDBFile();
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
  
  transV1toV2: function(dbConn) {
    dbConn.createTable(DB_TABLE_NAME_V2, DB_TABLE_FIELD_V2);
    dbConn.beginTransaction();

    var stmt = dbConn.createStatement("SELECT * FROM "+DB_TABLE_NAME);
    try {
      while (stmt.executeStep())
      {
        var sitename = stmt.getUTF8String(0);
        var filter  = stmt.getUTF8String(1);
        var addr    = stmt.getUTF8String(2);
        var icon    = stmt.getUTF8String(3);
        var charcase = stmt.getInt32(4);
        var enabled = (stmt.getInt32(5)!=0);
        var reserve = stmt.getInt32(6);
        var stmt2 = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?,?)");
        stmt2.bindUTF8StringParameter(0, sitename);
        stmt2.bindUTF8StringParameter(1, filter);
        stmt2.bindUTF8StringParameter(2, "");
        stmt2.bindUTF8StringParameter(3, "");
        stmt2.bindUTF8StringParameter(4, addr);
        stmt2.bindUTF8StringParameter(5, icon);
        stmt2.bindInt32Parameter(6, charcase);
        stmt2.bindInt32Parameter(7, enabled ? 1 : 0);
        stmt2.bindInt32Parameter(8, reserve);
        try {
          stmt2.execute();
        }
        catch(ex2) {}
        finally { stmt2.reset(); stmt2.finalize(); }
      }
    }
    catch(ex) {}
    finally { stmt.reset(); stmt.finalize(); }

    dbConn.commitTransaction();
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+DB_TABLE_NAME);
  },
  
  loadSiteData: function () {
    this.site_ = [];
    var dbConn = this.getDBConnection(false);
    if (!dbConn || this.getTableVersion(dbConn)==0 )
      return false;
    if(this.getTableVersion(dbConn)==1)
      this.transV1toV2(dbConn);

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

  onLoad: function() {
    //this.loadSiteData(); fix bug, that cause loadData twice when start up.
    this.prefListener = new EttDSharp.PrefListener('extensions.dsharp.options.', function(branch, name) {EttDSharp.onPrefChange(EttDSharp, branch, name);});
    this.prefListener.register();
    document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", EttDSharp.contextMenuShowing, false);
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);
    this.FXVersion = parseFloat(appInfo.version);
    var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
    timer.initWithCallback({ notify: function(timer) { EttDSharp.checkVerion(); } }, 10, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },

  onUnload: function() {
    document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", EttDSharp.contextMenuShowing, false);
    this.prefListener.unregister();
    //var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    //try{prefs.deleteBranch('extensions.dsharp.options.updateSetting');}catch(ex){}
  },

  openDsharpTool: function() {
    var sel = document.commandDispatcher.focusedWindow.getSelection();
    var str;
    if(!sel.isCollapsed)
      str = this.trim_both(sel.toString());
    else
      str = "";
    const EMURL = "chrome://dsharp/content/dsharpList.xul";
    const EMFEATURES = "chrome, dialog=yes, resizable=yes, modal=no, centerscreen";
    var retVals = { selectedText: str};
    window.openDialog(EMURL, "", EMFEATURES, retVals);
  },

  autoResult: function(urlx) {
    var menu = document.getElementById("dsharp_submenu-decode");
    var url = menu.firstChild.getAttribute("url");
    this.decodeUrl(url);
  },

  decodeUrl: function(url) {
    if(this.action_==0)
    {
      var doc = gBrowser.contentDocument;
      this.checkURL(url, doc);
      var charset = gBrowser.contentDocument.characterSet;
      var referer = makeURI(doc.location.href);
      gBrowser.loadOneTab(url, referer, charset, null, false, false);
    }
    else if(this.action_==1)
    {
      var clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
      clipboardHelper.copyString(url);
    }
    else// if(this.action_==2)
    {
      var doc = gBrowser.contentDocument;
      this.checkURL(url, doc);
      var charset = gBrowser.contentDocument.characterSet;
      var referer = makeURI(doc.location.href);
      gBrowser.loadOneTab(url, referer, charset, null, true, false);
    }
  },

  checkURL: function(aURL, aDoc, aFlags) {
    urlSecurityCheck(aURL, aDoc.nodePrincipal, aFlags);
  },

  createSubMenu: function(sitename, url, image) {
    var menu = document.getElementById("dsharp_submenu-decode");

    const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var item = document.createElementNS(XUL_NS, "menuitem"); // create a new XUL menuitem
    item.setAttribute("label", sitename);
    if(image) {
        item.setAttribute('class', 'menuitem-iconic');
        item.setAttribute('image', image);
    }
    //item.setAttribute('oncommand', "EttDSharp.decodeUrl('"+url+"');");
    item.setAttribute('url', url);
    item.addEventListener('command', function(event){EttDSharp.decodeUrl(event.target.getAttribute('url'));});
    menu.appendChild(item);
    return item;
  },

  contextMenuShowing: function(e) {
    if (e.originalTarget != document.getElementById("contentAreaContextMenu"))
      return;
    var _this = EttDSharp;

    var menu = document.getElementById("dsharp_submenu-decode");
    while(menu.hasChildNodes()){
        menu.removeChild(menu.firstChild);
    }

    var strBundle = document.getElementById("dsharp-strbundle");

    var menuitem = null;
    var sel = document.commandDispatcher.focusedWindow.getSelection();
    if(!sel.isCollapsed)
    {
      var str = _this.trim_both(sel.toString());
      if(str.length == 0)
      {
        _this.hideAllMenuItems();
        return;
      }
      for(var i = 0; i < _this.site_.length; ++i)
      {
        if(_this.site_[i].enabled)
        {
          //test filter...
          var regex = new RegExp(_this.site_[i].filter, 'i');
          if(regex.test(str))
          {
            var splits = str.split(regex);
            if(splits.length>1)
            {
              var url;
              var keyword = splits[1];
              if(_this.site_[i].replacef!='')
              {
                var regex2 = new RegExp(_this.site_[i].replacef, '');
                keyword = keyword.replace(regex2, _this.site_[i].replaceto);
              }
              if(_this.site_[i].charcase==1)
                url = _this.site_[i].addr + keyword.toUpperCase();
              else if(_this.site_[i].charcase==2)
                url = _this.site_[i].addr + keyword.toLowerCase();
              else //if(_this.site_[i].charcase==0)
                url = _this.site_[i].addr + keyword;
              _this.createSubMenu(_this.site_[i].sitename, url, _this.site_[i].icon);
            }
          }
        }
      }
      if(menu.hasChildNodes())
      {
        if(_this.autoResult_ && menu.childNodes.length==1)
        {
          var stringBundle = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
          var mystrings = stringBundle.createBundle('chrome://dsharp/locale/dsharp.properties');
          document.getElementById("dsharp_menu").hidden = true;
          menuitem = document.getElementById("dsharp_autoResult");
          menuitem.hidden = false;
          menuitem.setAttribute("label", mystrings.GetStringFromName('decode')+": "+menu.firstChild.getAttribute("label"));
          //menuitem.setAttribute("oncommand", menu.firstChild.getAttribute("oncommand"));
        }
        else
        {
          document.getElementById("dsharp_menu").hidden = false;
          document.getElementById("dsharp_autoResult").hidden = true;
        }
      }
      else
      {
        document.getElementById("dsharp_menu").hidden = true;
        document.getElementById("dsharp_autoResult").hidden = true;
      }
    }
    else
    {
      _this.hideAllMenuItems();
    }
  },

  hideAllMenuItems: function () {
      menuitem = document.getElementById("dsharp_autoResult");
      menuitem.hidden = true;
      menuitem = document.getElementById("dsharp_menu");
      menuitem.hidden = true;
  },

  PrefListener: function (branchName, func) {
    var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
    var branch = prefService.getBranch(branchName);
    branch.QueryInterface(Components.interfaces.nsIPrefBranch);
    this.register = function() {
      branch.addObserver("", this, false);
      branch.getChildList("", { })
        .forEach(function (name) { func(branch, name); });
    };
    this.unregister = function() {
      if (branch)
        branch.removeObserver("", this);
    };
    this.observe = function(subject, topic, data) {
      if (topic == "nsPref:changed")
        func(branch, data);
    };
  },

  onPrefChange: function(_this, branch, name) {
    try {
      switch (name) {
        case "action":
          _this.action_ = branch.getIntPref(name);
          break;
        case "autoResult":
          _this.autoResult_ = branch.getBoolPref(name);
          break;
        case "updateSetting":
          //update setting
          _this.loadSiteData();
          break;
      }
    } catch(e) {
      // eats all errors
      return;
    }
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

  openURL: function(aURL) {
    try{
      var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
               .getService(Components.interfaces.nsIWindowMediator)
               .getMostRecentWindow("navigator:browser");
      if(win)
        win.gBrowser.loadOneTab(aURL, null, null, null, false, false);
      else
        window.open(aURL);
    }
    catch(ex){}
  },

  getPrefs: function() {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
               .getService(Components.interfaces.nsIPrefService)
               .getBranch("extensions.dsharp.options.");
    return prefs;
  },

  checkVerion: function() {
    var prefs = this.getPrefs();
    var lastVersion = prefs.getComplexValue("Version", Components.interfaces.nsISupportsString).data;
    var showVersionHistory = prefs.getBoolPref("ShowVersionHistory");
    if(lastVersion=="0.0.0")//first install
    {
      //Add default value to database.
      this.addDefaultSite();
      //EttDSharp.openURL('chrome://bbsfox/locale/help.htm');
    }
    if(EttDSharp.FXVersion >= 4.0) //for firefox 4
    {
      try {
        // Firefox 4 and later; Mozilla 2 and later
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
        AddonManager.getAddonByID("{D74DB96C-B16D-4515-9CBC-3C3CCEB0175C}", function(addon) {
          EttDSharp.DSharpVersion=addon.version;
          //EttDSharp.dempDebugMessage('DSharpVersion='+EttDSharp.DSharpVersion);
          if(EttDSharp.DSharpVersion != lastVersion)
          {
            var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
            sString.data = EttDSharp.DSharpVersion;
            prefs.setComplexValue("Version", Components.interfaces.nsISupportsString, sString);
            if(showVersionHistory)
            {
              //EttDSharp.openURL('chrome://dsharp/locale/history.htm');
            }
            //EttDSharp.cleanupOldPref();
          }
        });
      }
      catch(ex){
      }
    }
    else
    {
      try {
        // Firefox 3.6 and before; Mozilla 1.9.2 and before
        var em = Components.classes["@mozilla.org/extensions/manager;1"]
                 .getService(Components.interfaces.nsIExtensionManager);
        var addon = em.getItemForID("{D74DB96C-B16D-4515-9CBC-3C3CCEB0175C}");
        EttDSharp.DSharpVersion=addon.version;
        //EttDSharp.dempDebugMessage('DSharpVersion='+EttDSharp.DSharpVersion);
        if(EttDSharp.DSharpVersion != lastVersion)
        {
          var sString = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
          sString.data = EttDSharp.DSharpVersion;
          prefs.setComplexValue("Version", Components.interfaces.nsISupportsString, sString);
          if(showVersionHistory)
          {
            //EttDSharp.openURL('chrome://dsharp/locale/history.htm');
          }
          //EttDSharp.cleanupOldPref();
        }
      }
      catch(ex){
      }
    }
  },

  //
  addDefaultSite: function() {
    var dbConn = this.getDBConnection(true);
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+DB_TABLE_NAME);
    dbConn.executeSimpleSQL("DROP TABLE IF EXISTS "+DB_TABLE_NAME_V2);
    dbConn.createTable(DB_TABLE_NAME_V2, DB_TABLE_FIELD_V2);
    dbConn.beginTransaction();
    var defaultSite = [];

    //save some default site to sqlite database - start
    /*
    ^(sm([0-9]{1,10}))$      //http://www.nicovideo.jp/watch/
    ^([0-9]{1,10})$        //http://www.pixiv.net/member_illust.php?mode=big&illust_id=
    ^([0-9]{1,8})$         //http://www.pixiv.net/member.php?id=

    ^([a-zA-Z0-9]{4,5})$   //http://goo.gl/
    ^([a-zA-Z0-9]{4,6})$   //http://bit.ly/
    ^([a-zA-Z0-9]{6,7})$   //http://tinyurl.com/
    ^([a-zA-Z0-9]{5})$     //http://0rz.tw/
    ^(.{4})$               //http://ppt.cc/
    ^([a-zA-Z0-9]{5,6})$   //http://is.gd/

    ^htp:\/\/            //http://
    ^ttp:\/\/            //http://
    ^http\/\/            //http://
    */
    var stringBundle = Cc['@mozilla.org/intl/stringbundle;1'].getService(Ci.nsIStringBundleService);
    var mystrings = stringBundle.createBundle('chrome://dsharp/locale/dsharp.properties');
    var defaultSiteName;
    var ns;
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName0');
    ns = new EttDSharpSite(defaultSiteName, '^htp:\/\/|^ttp:\/\/|^http\/\/', '', '', 'http://', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAAXNSR0IArs4c6QAAAwBQTFRFNDQ0AAAAPj4+RkZGTU1NVFRUX19faGhobGxscXFxdXV1eHh4fHx8gICAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeVNWkAAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAA7AAAAOwAFq1okJAAAAB3RJTUUH3AMcDQMLQGD9GwAAAEJJREFUGNNjYGBgRAIMDKh8kAgjGsAmwAsEICYvIy9UgJGRjRdNAMThhaiEC0AV4FLBiqoCYgtCgLDD8HsG3bsMDACXFALeg0xsFwAAAABJRU5ErkJggg==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName1');
    ns = new EttDSharpSite(defaultSiteName, '^(sm([0-9]{1,10}))$', '', '', 'http://www.nicovideo.jp/watch/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAD////9/////f////3////9/////f////3////9/////f////3////9/////f////3////9/////f////3////9/////f////0zMzP9/////f////3////9/////f////3////9/////f////3////9/////TMzM/3////9/////f////0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/f////3////9MzMz/f////3////9/////f////3////9/////f////3////9/////f////3////9/////TMzM/3////9/////TMzM/3////9/////f////3////9MzMz/TMzM/0zMzP9MzMz/f////3////9/////f////0zMzP9/////f////0zMzP9/////f////3////9/////f////0zMzP9MzMz/f////3////9/////f////3////9MzMz/f////3////9MzMz/f////3////9/////f////3////9/////f////3////9/////f////3////9/////TMzM/3////9/////TMzM/3////9/////f////3////9/////f////3////9/////f////3////9MzMz/f////0zMzP9/////f////0zMzP9/////TMzM/3////9/////f////3////9/////f////3////9/////f////3////9MzMz/f////3////9MzMz/f////3////9/////f////3////9/////f////3////9/////f////3////9/////TMzM/3////9/////TMzM/3////9/////f////3////9/////f////3////9/////f////3////9/////f////0zMzP9/////f////0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/TMzM/0zMzP9MzMz/f////3////9/////f////3////9/////f////3////9MzMz/TMzM/3////9/////f////3////9/////f////3////9/////f////3////9/////f////0zMzP9MzMz/f////3////9MzMz/TMzM/3////9/////f////3////9/////f////3////9/////TMzM/0zMzP9/////f////3////9/////f////3////9MzMz/TMzM/3////9/////f////3////9/////f////3////9/////f////3////9/////f////3////9/////f////3////9/////f////3////9AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==', 2, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName2');
    ns = new EttDSharpSite(defaultSiteName, '^([0-9]{1,10})$', '', '', 'http://www.pixiv.net/member_illust.php?mode=big&illust_id=', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACpcgBisX4U6/bw4v/z69n/rnsQ/6lzAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AO2qdABnqnMA86lyAP/y6tb/7uPK/6dwAP+pcwD/qHEA/6hwAP+ocQD/qnMA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA86pzAP+qcwD/8+vY/+3hyP+lbAD/sH4S/7mMK/+7jzL/tIUe/6pzAP+mbQD/qnMA/6p0AP+qdAD/qnQA/6p0AP+qcwD/qnMA//Dn0f/38ub/4s6n/+jZuv/o2Ln/6du9//Hn0//w5c//zq5s/6t0BP+ocQD/q3UA/6p0AP+qdAD/qnMA/6pzAP/x6NP/9vDi/72TO/+uegz/qXIA/6lxAP+vexL/zq9t///+/P/q3L7/r3sS/6lxAP+qdAD/qnQA/6pzAP+qcwD/8+vY/+7iyf+lbAD/qnMA/6p0AP+qdAD/qXIA/6NpAP/DnEn//////+XTrv+ocAD/qnQA/6p0AP+qcwD/qnMA//Pr1//v5Mv/qHEA/6p0AP+qdAD/qnQA/6p0AP+qdAD/pmwA/+jYt///////u48w/6hwAP+qdAD/qG8A/6pzAP/z69f/7+TL/6hxAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6VsAP/Ttnj//////8yrY/+mbAD/qnQA/8ilWf+ocAD/8+rY/+/ky/+ocQD/qnQA/6p0AP+qdAD/qnQA/6p0AP+lbAD/07Z4///////LqmL/pm0A/6p0AP/69u3/s4Ia//Dlz//v5Mz/qHEA/6p0AP+qdAD/qnQA/6p0AP+rdAD/pmwA/+bVsf//////u48v/6hwAP+qdAD/4Muh//Ho1P/59Ov/7N/D/6VsAP+qdAD/qnQA/6p0AP+qdAD/pWoA/7yQMv//////59e0/6hwAf+qdAD/qnQA/6ZtAP/IpVz/9e7f//n06v++lT3/qXMA/6ZtAP+lbAD/qG8A/7+WQv/59ez/8ObP/7F/GP+ocQD/qnQA/6p0AP+qdAD/pm0A/656D//PsG//693B/+fYuP/eyJz/3caZ/+jZuv/z69n/2L6J/655Df+ocAD/q3UA/6p0AP+qdAD/qnQA/6t0AP+pcgD/pWwA/6pzAP+3iSb/wppF/8SeTf+9kjf/rnoL/6ZsAP+pcgD/q3UA/6p0AP+qdAD/qnQA/6p0AO6qdAD/qnQA/6p0AP+qdAD/qHEA/6dvAP+nbgD/qHAA/6lzAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AO+qdABaqnQA6Kp0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AOuqdABfAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQ==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName3');
    ns = new EttDSharpSite(defaultSiteName, '^([0-9]{1,8})$', '', '', 'http://www.pixiv.net/member.php?id=', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACpcgBisX4U6/bw4v/z69n/rnsQ/6lzAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AO2qdABnqnMA86lyAP/y6tb/7uPK/6dwAP+pcwD/qHEA/6hwAP+ocQD/qnMA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA86pzAP+qcwD/8+vY/+3hyP+lbAD/sH4S/7mMK/+7jzL/tIUe/6pzAP+mbQD/qnMA/6p0AP+qdAD/qnQA/6p0AP+qcwD/qnMA//Dn0f/38ub/4s6n/+jZuv/o2Ln/6du9//Hn0//w5c//zq5s/6t0BP+ocQD/q3UA/6p0AP+qdAD/qnMA/6pzAP/x6NP/9vDi/72TO/+uegz/qXIA/6lxAP+vexL/zq9t///+/P/q3L7/r3sS/6lxAP+qdAD/qnQA/6pzAP+qcwD/8+vY/+7iyf+lbAD/qnMA/6p0AP+qdAD/qXIA/6NpAP/DnEn//////+XTrv+ocAD/qnQA/6p0AP+qcwD/qnMA//Pr1//v5Mv/qHEA/6p0AP+qdAD/qnQA/6p0AP+qdAD/pmwA/+jYt///////u48w/6hwAP+qdAD/qG8A/6pzAP/z69f/7+TL/6hxAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6VsAP/Ttnj//////8yrY/+mbAD/qnQA/8ilWf+ocAD/8+rY/+/ky/+ocQD/qnQA/6p0AP+qdAD/qnQA/6p0AP+lbAD/07Z4///////LqmL/pm0A/6p0AP/69u3/s4Ia//Dlz//v5Mz/qHEA/6p0AP+qdAD/qnQA/6p0AP+rdAD/pmwA/+bVsf//////u48v/6hwAP+qdAD/4Muh//Ho1P/59Ov/7N/D/6VsAP+qdAD/qnQA/6p0AP+qdAD/pWoA/7yQMv//////59e0/6hwAf+qdAD/qnQA/6ZtAP/IpVz/9e7f//n06v++lT3/qXMA/6ZtAP+lbAD/qG8A/7+WQv/59ez/8ObP/7F/GP+ocQD/qnQA/6p0AP+qdAD/pm0A/656D//PsG//693B/+fYuP/eyJz/3caZ/+jZuv/z69n/2L6J/655Df+ocAD/q3UA/6p0AP+qdAD/qnQA/6t0AP+pcgD/pWwA/6pzAP+3iSb/wppF/8SeTf+9kjf/rnoL/6ZsAP+pcgD/q3UA/6p0AP+qdAD/qnQA/6p0AO6qdAD/qnQA/6p0AP+qdAD/qHEA/6dvAP+nbgD/qHAA/6lzAP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AO+qdABaqnQA6Kp0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AP+qdAD/qnQA/6p0AOuqdABfAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQ==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName4');
    ns = new EttDSharpSite(defaultSiteName, '^([a-zA-Z0-9]{4,5})$', '', '', 'http://goo.gl/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7PT7/3zF6/9Ptu//RbHx/0227/+Tzvb/9vv5/97h0f9JeBz/NHoA/z98Av9AfAD/PHsA/0F6AP8AAAAA/vz7/1+33/8Mp+z/FrHw/xWy8f8bs/T/Hqrx/3zE7v////7/t8qp/zF2A/87gwH/P4ID/z59AP8+egD/Q3kA/97s8v8botj/ELn3/wy58f8PtfL/D7Lw/xuz9P8vq+f/8/n///779v9KhR3/OYYA/0GFAv88hgD/QIAC/z17AP/0+/j/N6bM/wC07/8Cxf7/CsP7/wm+9v8Aqur/SrDb//7+/v///P7/VZEl/zSJAP87jQD/PYYA/0OBBf8+fQH///3//9Dp8/84sM7/CrDf/wC14/8CruL/KqnW/9ns8f/8/v//4OjX/z+GDf85kAD/PIwD/z2JAv8+hQD/PoEA/9C7pv/97uv////+/9Xw+v+w3ej/ls/e/+rz9///////+/z6/22mSf8qjQH/OJMA/zuQAP85iwL/PIgA/zyFAP+OSSL/nV44/7J+Vv/AkG7/7trP//7//f/9//7/6/Lr/2uoRv8tjQH/PJYA/zuTAP87kwD/PY8A/z2KAP89hAD/olkn/6RVHP+eSgj/mEgR//Ho3//+/v7/5Ozh/1GaJv8tlAD/OZcC/zuXAv84lAD/O5IC/z2PAf89iwL/OIkA/6hWFf+cTxD/pm9C/76ihP/8/v//+////8nav/8fdwL/NZsA/zeZAP83mgD/PJQB/zyUAf84jwD/PYsB/z6HAf+fXif/1r6s//79///58u//3r+g/+3i2v/+//3/mbiF/yyCAP87mgP/OpgD/zeWAP85lgD/OpEB/z+TAP9ChwH/7eHb/////v/28ej/tWwo/7tUAP+5XQ7/5M+5/////v+bsZn/IHAd/zeVAP89lgP/O5MA/zaJCf8tZTr/DyuK//3////9////0qmC/7lTAP/KZAT/vVgC/8iQWf/+//3///j//ygpx/8GGcL/ESax/xEgtv8FEMz/AALh/wAB1f///f7///z//758O//GXQL/yGYC/8RaAv/Ojlf/+/////////9QU93/BAD0/wAB//8DAP3/AAHz/wAA5f8DAtr///////v7+/+2bCT/yGMA/89mAP/BWQD/0q+D///+/////P7/Rkbg/wEA+f8AA/z/AQH5/wMA8P8AAev/AADf///7/P////7/uINQ/7lXAP/MYwL/vGIO//Lm3P/8/v//1dT2/woM5/8AAP3/AwH+/wAB/f8AAfb/BADs/wAC4P8AAAAA//z7/+LbzP+mXyD/oUwE/9Gshv/8//3/7/H5/zo/w/8AAdX/AgL6/wAA/f8CAP3/AAH2/wAA7v8AAAAAgAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAEAAA==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName5');
    ns = new EttDSharpSite(defaultSiteName, '^([a-zA-Z0-9]{4,6})$', '', '', 'http://bit.ly/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAABMLAAATCwAAAAAAAAAAAAAAAAAAVVVVAVVVVQ1VVVUxVVVVb1VVValVVVW/VVVVv1VVVb9VVVWpVVVVb1VVVTFVVVUNVVVVAQAAAAAAAAAAAAAAAFVVVQ1VVVVAVVVVjVVVVc9RYmr3PLXw/0Gi0f9BotH/QaLR/zy18P9QZ3OxVVVVQFVVVQ0AAAAAAAAAAFVVVQVVVVUxVVVVjVVVVd5Jgp39PLXw/0+ZvP9Yc3//WHN//1hzf/9Pmbz/PLXw/0eJqdxVVVVAVVVVBgAAAABVVVUVVVVVZVVVVcpKgp39PLz6/0Go2/9Yc3//RKnb/0Oi0f9Eqdv/WHN//0Ki0f88vPr/SIyu0FVVVRcAAAAAVVVVPVVVVZ5SY2vxQbbw/0C9+v9Eqdv/RKnb/0C9+v9Avfr/QL36/0G28P9CsOX/QL36/0C9+v9QbnyHVVVVCVVVVY5VVVXXToOd/US/+v9Ev/r/RL/6/0S/+v9Ev/r/RL/6/0S/+v9Ev/r/RL/6/0S/+v9Ev/r/TYyr11VVVSJVVVXRUneJ/FS25v9NtOb/U2l0/1RcX/9Pmbz/TML6/0zC+v9Nu/D/UXeJ/1Riav9Pmbz/TML6/1i45v9WiqSnTbTm/3HO/P9xzvz/Vo2o/6qqqv9VVVX/lZyf/1fF+/9Xxfv/VpSy/7W1tf9VVVX/n5+f/1fF+/9NtOb/V8X7/1VVVV2q4f3/quH9/1+Xsv/f39//9PT0/4KOlP9myvv/Zsr7/1+Xsv/V1dX//////4ySlf9myvv/suT9/4+4zOJVVVUeYmdpiKC9zPh3yfH/a5uz/2eMnv9zut3/edH8/3nR/P950fz/aZOp/3eSnv9vqsj/edH8/6vJ1+N8hosyVVVVBlVVVTlea3G9i9Dy/5DZ/P+Q2fz/kNn8/5DZ/P+Q2fz/kNn8/5DZ/P+Q2fz/kNn8/4vQ8v9ph5ZTAAAAAFVVVRRVVVVOVVVVp3WKlveQ2fz/rOL9/6zi/f+s4v3/rOL9/6zi/f+s4v3/rOL9/6zi/f+JrL2zAAAAAAAAAABVVVU4VVVVllVVVd9Yc3/8g7jS/5DZ/P+Q2fz/zu7+/87u/v/O7v7/zu7+/8Xk8/+asr2zVVVVEQAAAAAAAAAAVVVVOlVVVal0rsn8RL/6/0Oi0f9/vt3/p8XT/8PO1P/K0dT/xc3Q8rG6vrV3e31DAAAAAAAAAAAAAAAAAAAAAFVVVRdVVVVmlsnh+ES/+v9Ev/r/RL/6/3nR/P+l4P3/YW1zWQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABVVVUCVVVVEFVVVUWZsr3OxeTz/3nR/P+Q2fz/ze7+/1VVVUMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAMAwIADyMcAAQA+AAEBPgAAAT4AAAI+AAACPgAAAz4AAAM+AAAEPgABBD4AAwU+AAMFPgAPBj4AfwY+AH8HPg==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName6');
    ns = new EttDSharpSite(defaultSiteName, '^([a-zA-Z0-9]{6,7})$', '', '', 'http://tinyurl.com/', 'data:image/gif;base64,R0lGODlhEAAQAIAAAP///wAAmSH5BAAAAAAALAAAAAAQABAAQAIpjI9pcAy/Egsu0obrRdNVrYRYpE3iSUHlZXasi8byxpJc1krQ5plzUAAAOw==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName7');
    ns = new EttDSharpSite(defaultSiteName, '^([a-zA-Z0-9]{5,6})$', '', '', 'http://is.gd/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAGABoAwAAFgAAACgAAAAQAAAAIAAAAAEAGAAAAAAAAAAAACMuAAAjLgAAAAAAAAAAAAAACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcwN8VAR8lAR8lAR8kACbcACbcgKMBAR8lAR8lAR8lAR8lAR8lAR8kACbcACbcACbe/we3///////////8ACbdQVs7////////////////////////////P0fEACbcACbe/we3///////////8ACbd/hNv///////////////////////////////8ACbcACbe/we3///////////8ACbd/hNv////////////P0fHv8Pr///////////8ACbcACbe/we3///////////8ACbdAR8l/hNt/hNt/hNsgKMC/we3///////////8ACbcACbe/we3///////////8ACbcwN8Xf4Pb///////////////////////////8ACbcACbe/we3///////////8ACbd/hNv///////////////////////////////8ACbcACbe/we3///////////8ACbd/hNv///////////////////////////+Pk98ACbcACbePk9+/we2/we2/we0ACbd/hNv///////////9AR8kwN8VAR8lAR8lAR8kACbcACbdgZtJ/hNt/hNt/hNsACbd/hNv///////////+fouTf4Pb///////////8ACbcACbe/we3///////////8ACbd/hNv///////////////////////////////8ACbcACbe/we3///////////8ACbdwddf////////////////////////////v8PoACbcACbdgZtJ/hNt/hNt/hNsACbcACbdgZtJ/hNt/hNt/hNt/hNt/hNt/hNsgKMAACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcACbcAACJWAAADywAAF7EAAAUpAAB/KAAAahIAAD+LAACxigAAkK4AAO3WAAB/7AAARQEAAG2fAAB1WgAAkKkAAEv0', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName8');
    ns = new EttDSharpSite(defaultSiteName, '^([a-zA-Z0-9]{5})$', '', '', 'http://0rz.tw/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///8B////Af///wEAAAADqlg5d6JUNqkiEAolAAAAA////wH///8B////AQAAAAMAAAAD////Af///wH///8B////Af///wH///8B////ARQJBRHDYz7Zt1w51xcKBjs4Gg47bzQeV4Q/JWePQyZ5gz0iaQAAABH///8B////Af///wEAAAADAAAACRUKBSV9PCNlsVY01c1kPP/FXzj7y2E5/8pgN//JXzb/yF00/8dcM/9+OR57AAAAA////wEAAAAJfTwiX6hRML3EXzj1y2E5/8pgN//JXzb/yF00/8dcM//GWjH/xVkw/8RYLv/DViz/p0kk1QAAABH///8Bk0UnV8pgN//JXzb/yF00/8dcM//GWjH/xVkw/8RYLv/DViz/wlUr/8FTKf/AUij/v1Am/7xOJP89GApB////AZ9IJ2/GWjH/xVkw/8RYLv/DViz/wlUr/8FTKf/AUij/v1Am/75PJf+9TiP/vEwi/7tLIP+6Sh//gTMViQAAAAOYQyJhwlUr/8FTKf/AUij/v1Am/75PJf+9TiP/vEwi/7tLIP+6Sh//ukof/7pKH/+6Sh//ukof/5g8GcUAAAAJijocT75PJf+9TiP/vEwi/7tLIP+6Sh//ukof/7pKH/+6Sh//ukof/7pKH/+6Sh//ukof/7pKH/+sRBzrAAAAGVwmETW6Sh//ukof/7pKH/+6Sh//u0wh/71PJP++UCX/vlAl/71OJP+7TCH/ukof/7pKH/+6Sh//uUkf/yANBjUAAAAXtkge9b1OI//CViz/xlsy/8hdNP/IXTT/yF00/8hdNP/IXTX/yF01/8dcM//DVy3/vlAm/7pKH/9eJhBTAAAAB7VULs3KYTj/ymE5/8phOf/KYTn/ymE5/8phOf/KYTn/ymE5/8phOf/KYTn/y2E5/8thOf/IXjX/fDgeZwAAAAOpUzKXzWU9/81lPf/NZT3/zWU9/81lPf/NZT3/zWU9/81lPf/NZT3/zWU9/81lPf/NZT3/zWU9/4hDKHUAAAADi0YrT9BpQf/QaUH/0GlB/9BpQf/QaUH/0GlB/9BpQf/QaUH/0GlB/9BpQf/QaUH/0GlB/9BpQf+PSCx1////AQkEAxPKaELp02xF/9NsRf/TbEX/021F/9NtRf/TbUX/021F/9NtRf/TbUX/021F/9FsRf+5Xz3DRyQXI////wEAAAAFs149ndVwSf/VcEn/1XBJ/9VwSf/VcEn/1XBJ/9VwSv/Sbkj5v2VBzaZXOIthMiA5AAAACwAAAAP///8BAAAAA3c/KinEaUbDyWxI3cZqR9G+ZkTBs2BAqadZO4GOSzJRIhIMIwAAAAkAAAADAAAAA////wH///8BAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQ==', 0, true, 0);
    defaultSite.push(ns);
    defaultSiteName = mystrings.GetStringFromName('defaultSiteName9');
    ns = new EttDSharpSite(defaultSiteName, '^(.{4})$', '', '', 'http://ppt.cc/', 'data:image/x-icon;base64,AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+//3+/v/97/3//e/9//3v/f/97/3//e/9//3v/f/97/3//f7+//3+/v+k6ub/v+nv/+Xz+f/9/v7//f7+//3+/v/9/v7//e/9/6CZsP+ghZL/9NHX/6CZsP+ghZL/9NHX//3v/f+/6e//FxHW/xcR1v8XEdb/Ky/S//3+/v/9/v7//f7+//3v/f+ghZL/9NHX//TR1/+ghZL/9NHX//TR1//97/3/lpa9/ycVrv+EARX/PB99/5aWvf/9/v7//f7+//3+/v/97/3/oIWS/6CFkv/00df/nZKj/6CFkv/00df//e/9/5aWvf88H33/hAEV/zEalf+Wlr3//f7+//3+/P/0xx//8NlN//PlvP+w6er/cu/X/4Xr4P+F6+D/sOnq//3+/v8rL9L/PB99/4QBFf8nFa7/sOnq//3+/v/+9M3/5KgV/5YgFP+vThT/8NlN/wfytP8H8rT/B/K0/ysv0v8rL9L/Ky/S/2UJMf+EARX/FxHW/7/p7//l8/n/+emU/+GkFf+EARX/r04U//Thbv8H8rT/Cuuf/yW2gP8hItn/Xgox/14KMf98BB7/hAEV/ycVrv8XEdb/FxHW//Thbv+vThT/hAEV/69OFP/1wxz/89Ay/5xCGv+EARb/FxHW/2UJMf95BSD/hAEV/4QBFf+EARX/fAQe/xcR1v/z0DL/miYT/4QBFf+EARX/hwUU/69OFP/0xx//hwUU/ysv0v8hItn/FxHW/xcR1v8XEdb/JxWu/ycVrv8rL9L/9cMc/4UCFP+OERT/77oZ/54tE/+EARX/4aQV/6U5E/+EARX/hAEV/4QBFf95BSD/EdSY/37t3P+Wlr3/v+nv/+GkFf+EARX/jhEU/69OFP+SGRT/hAEV/+SoFf+iNBP/eQUg/xbLkv9VVE//hAEV/0aBZf9u+s///f7+//3+/v/vuhn/4aQV/69OFP+aJhP/iwsU/69OFP/0xx//ggIY/4QBFv82mnD/cTUr/4QBFf83l27/eu/X//3+/v/9/v7//vbV//7tqv/04W7/89VA//THH//w2U3/YfGl/2o0L/+EARX/hAEW/2o0L/9Ch2f/B/Cw/+Xz+f/9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+/2j+zP8ltoD/JbaA/wrrn/9Y/Lz/bvrP/+Xz+f/9/v7//f7+//3+/v/9/v7//f7+//3+/v/9/v7//f7+//3+/v/Z8Pf/eu/X/7Dp6v/1+/3//f7+//3+/v/9/v7//f7+//3+/v/9/v7/AACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQAArEEAAKxBAACsQQ==', 0, true, 0);
    defaultSite.push(ns);

    for(var i in defaultSite){
      var stmt = dbConn.createStatement("INSERT INTO "+DB_TABLE_NAME_V2+" VALUES(?,?,?,?,?,?,?,?,?)");

      stmt.bindUTF8StringParameter(0, defaultSite[i].sitename);
      stmt.bindUTF8StringParameter(1, defaultSite[i].filter);
      stmt.bindUTF8StringParameter(2, defaultSite[i].replacef);
      stmt.bindUTF8StringParameter(3, defaultSite[i].replaceto);
      stmt.bindUTF8StringParameter(4, defaultSite[i].addr);
      stmt.bindUTF8StringParameter(5, defaultSite[i].icon);
      stmt.bindInt32Parameter(6, defaultSite[i].charcase);
      stmt.bindInt32Parameter(7, defaultSite[i].enabled ? 1 : 0);
      stmt.bindInt32Parameter(8, defaultSite[i].reserve);
      try {
        stmt.execute();
      }
      catch(ex) {}
      finally { stmt.reset(); stmt.finalize(); }
    }
    dbConn.commitTransaction();
    //save some default site to sqlite database - end
    var t2 = new Date();
    var prefs = this.getPrefs();
    prefs.setIntPref("updateSetting", t2.getTime());
  }
};

window.addEventListener("load", function () { EttDSharp.onLoad(); }, false);
window.addEventListener("unload", function () { EttDSharp.onUnload(); }, false);