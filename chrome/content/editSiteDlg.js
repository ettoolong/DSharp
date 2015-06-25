function setAcceptBtn(enable) {
  document.getElementById('dsharp-editText').setAttribute('buttondisabledaccept', !enable);
}

function load() {
  var retVals = window.arguments[0];
  if(retVals.sitename)
  {
    document.getElementById("siteName").value = retVals.sitename;
    document.getElementById("filter").value = retVals.filter;
    document.getElementById("replacef").value = retVals.replacef;
    document.getElementById("replaceto").value = retVals.replaceto;
    document.getElementById("addr").value = retVals.addr;
    document.getElementById("case").value = retVals.charcase;
    document.getElementById("iconstr").value = retVals.icon;
    if(retVals.icon==null || retVals.icon=="")
    {
      document.getElementById("icon").style.opacity = 0;
    }
    else
    {
      var icon = document.getElementById("icon");
      icon.style.opacity = 1;
      icon.src = retVals.icon;
    }
    setAcceptBtn(true);
  }
}

function btnCancelClick() {
  var retVals = window.arguments[0];
  retVals.exec  = false;
  return true;
}

function btnOkClick() {
  var retVals = window.arguments[0];
  retVals.exec  = true;
  retVals.sitename  = document.getElementById("siteName").value;
  retVals.filter  = document.getElementById("filter").value;
  retVals.replacef  = document.getElementById("replacef").value;
  retVals.replaceto  = document.getElementById("replaceto").value;
  retVals.addr   = document.getElementById("addr").value;
  retVals.charcase   = document.getElementById("case").value;
  retVals.icon = document.getElementById("iconstr").value;
  retVals.reserve   = 0;
  return true;
}

function checkValue() {
  var n1 = document.getElementById("siteName").value;
  var n2 = document.getElementById("filter").value;
  var n3 = document.getElementById("addr").value;
  if(n1=='' || n2=='' || n3=='')
  {
    setAcceptBtn(false);
    return;
  }
  setAcceptBtn(true);
}

function onSelectFile() {
  var Cc = Components.classes, Ci = Components.interfaces;
  var fp = Cc['@mozilla.org/filepicker;1'].createInstance(Ci.nsIFilePicker);
  fp.init(window, null, Ci.nsIFilePicker.modeOpen);
  fp.appendFilters(fp.filterImages);
  if(fp.show() != Ci.nsIFilePicker.returnOK) return;
  var file = fp.file;
  var contentType = Cc['@mozilla.org/mime;1'].getService(Ci.nsIMIMEService).getTypeFromFile(file);
  var inputStream = Cc['@mozilla.org/network/file-input-stream;1'].createInstance(Ci.nsIFileInputStream);
  inputStream.init(file, 0x01, 0600, 0);
  var stream = Cc['@mozilla.org/binaryinputstream;1'].createInstance(Ci.nsIBinaryInputStream);
  stream.setInputStream(inputStream);
  var encoded = btoa(stream.readBytes(stream.available()));
  stream.close();
  inputStream.close();
  var iconstr = document.getElementById('iconstr');
  iconstr.value = 'data:' + contentType + ';base64,' + encoded;
  if(iconstr.value==null || iconstr.value=="")
  {
    document.getElementById("icon").style.opacity = 0;
  }
  else
  {
    var icon = document.getElementById("icon");
    icon.style.opacity = 1;
    icon.src = iconstr.value;
  }
}