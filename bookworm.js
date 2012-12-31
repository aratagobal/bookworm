window.onload = function() {
  var storage = navigator.getDeviceStorage("music");
  if (storage) {
    var booksCursor = storage.enumerate("books");
    var books = [];
    booksCursor.onsuccess = function(e) {
      var book = booksCursor.result;
      if (!book) {
        displayIndex(books);
        return;
      }
      books.push(book);
      booksCursor.continue();
    };
    booksCursor.onerror = function(e) {
      alert(booksCursor.error.name);
    };
  }

  hide(['toc', 'page']);
  
  var req = navigator.mozApps.getSelf();
  req.onsuccess = function() {
    hide('install');
  };
  
  var bookInput = document.getElementById('book');
  bookInput.onchange = function() {
    readFile(bookInput.files[0], function(data) {
      var zip = new JSZip(data);
      showContents(zip);
    });
  };  
};

function displayIndex(books) {
  var list = document.getElementById('books');
  for (var i = 0; i < books.length; i++) {
    var li = document.createElement("li");
    li.textContent = books[i].name;
    var book = books[i];
    li.onclick = function() {
      readFile(book, function(data) {
        var zip = new JSZip(data);
        showContents(zip);
      });
    };
    list.appendChild(li);
  }
}

function markTime(s) {
  if (gTimer) {
    var diff = Date.now() - gTimer;
    log(s + ": " + diff);
  }
  gTimer = Date.now();
}

function install() {
  navigator.mozApps.install("http://bookworm.localdomain:8000/manifest.webapp");
  return false;
}

var gTimer;

function handleContainer(archive, data) {
  var parser = new DOMParser();
  var doc = parser.parseFromString(data, "application/xml");
  var rootfile = doc.getElementsByTagNameNS("*", "rootfile")[0];
  var opffile = rootfile.getAttribute("full-path");
  var opfdata = archive.file(opffile);
  var opf = parser.parseFromString(opfdata.data, "text/xml");
  var package = opf.getElementsByTagNameNS("*", "package")[0];
  var metadata = opf.getElementsByTagNameNS("*", "metadata")[0];
  var manifest = opf.getElementsByTagNameNS("*", "manifest")[0];
  var spine = opf.getElementsByTagNameNS("*", "spine")[0];

  var toc = spine.getAttribute("toc");

  if (!toc) {
    toc = "ncx";
  }

  var itemref = spine.getElementsByTagNameNS("*", "itemref")[0];
  var idFirst = itemref.getAttribute("idref");

  var items = manifest.getElementsByTagNameNS("*", "item");

  for (var i = 0; i < items.length; i++) {
    var id = items[i].getAttribute("id");

    if (id == idFirst) {
      var hrefFirst = items[i].getAttribute("href");
    } else if(id == toc) {
      var hrefNcx = items[i].getAttribute("href");
    }
  }

  var epub = [];
  var identifier = null;

  try {
    var identifierId = package.getAttribute("unique-identifier");
    var identifiers = metadata.getElementsByTagNameNS("*", "identifier");

    for (var i = 0; i < identifiers.length; i++) {
      if (identifiers[i].getAttribute("id") == identifierId) {
        identifier = identifiers[i].childNodes[0].nodeValue;
        break;
      }
    }
  } catch (e) {
    dump("ops! no identifier.");
  }

  try {
    var title = metadata.getElementsByTagNameNS("*", "title")[0].childNodes[0].nodeValue;
    epub['title'] = title;
  } catch (e) {
  }

  if (title) {
    epub['title'] = title ? title : "Unknown";
  }

  try {
    var author = metadata.getElementsByTagNameNS("*", "creator")[0].getAttribute("opf:file-as");
  } catch (e) {
  }

  if (!author) {
    try {
      var author = metadata.getElementsByTagNameNS("*", "creator")[0].childNodes[0].nodeValue;
    } catch (e) {
    }
  }

  epub['author'] = author ? author : "Unknown";

  var hrefNcxFile = archive.file(hrefNcx);
  var nav = parser.parseFromString(hrefNcxFile.data, "text/xml");
  var navMap = nav.getElementsByTagNameNS("*", "navMap")[0];
  var navPoints = navMap.getElementsByTagNameNS("*", "navPoint");
  var pointsToc = [];
  if (navPoints && navPoints.length > 0) {
    var pointCounter = 0;

    for (var i = 0; i < navPoints.length; i++) {
      try {
        var label = navPoints[i].getElementsByTagNameNS("*", "navLabel")[0]
                                .getElementsByTagNameNS("*", "text")[0].textContent;

        var content = navPoints[i].getElementsByTagNameNS("*", "content")[0].getAttribute("src");
        var navPoint = navPoints[i];
        var point = [];

        for (var j = 1; j < 10; j++) {
          var parent = navPoint.parentNode;

          if (!parent.nodeName.match("navPoint")) {
            point['level'] = j;
            break;
          } else {
            navPoint = parent;
          }
        }

        point['label'] = label;
        point['content'] = content;

        pointsToc[pointCounter] = point;
        pointCounter++;
      } catch(e) {
      }
    }
  } else {
    var spine = opf.getElementsByTagNameNS("*", "spine")[0];
    var itemrefs = spine.getElementsByTagNameNS("*", "itemref");

    var manifest = opf.getElementsByTagNameNS("*", "manifest")[0];
    var items = manifest.getElementsByTagNameNS("*", "item");

    var pointCounter = 0;

    for (var i = 0; i < itemrefs.length; i++) {
      for (var j = 0; j < items.length; j++) {
        var idref = itemrefs[i].getAttribute("idref");
        var id = items[j].getAttribute("id");

        if (idref == id) {
          var href = items[j].getAttribute("href");
          var point = [];

          point['label'] = (i+1).toString() + ".";
          point['content'] = href;
          point['level'] = 1;

          pointsToc[pointCounter] = point;
          pointCounter++;
          break;
        }
      }
    }
  }

  var spine = opf.getElementsByTagNameNS("*", "spine")[0];
  var itemrefs = spine.getElementsByTagNameNS("*", "itemref");

  var manifest = opf.getElementsByTagNameNS("*", "manifest")[0];
  var items = manifest.getElementsByTagNameNS("*", "item");

  var pointsSpine = [];
  var pointCounter = 0;

  for (var i = 0; i < itemrefs.length; i++) {
    for (var j = 0; j < items.length; j++) {
      var idref = itemrefs[i].getAttribute("idref");
      var id = items[j].getAttribute("id");

      if (idref == id) {
        var href = items[j].getAttribute("href");
        var point = [];

        point['label'] = "Navpoint " + (i+1);
        point['content'] = href;

        pointsSpine[pointCounter] = point;
        pointCounter++;
        break;
      }
    }
  }
  
  function spacer(indent) {
    var el = document.createElement('span');
    while (indent--) {
      el.innerHTML += "&nbsp;&nbsp;&nbsp;";
    }
    return el;
  }

  var urls = [];  
  var list = document.getElementById('toc_entries');
  for (var i = 0; i < pointsToc.length; i++) {
    var el = document.createElement('li');
    //el.appendChild(spacer(pointsToc[i].level));
    var text = document.createTextNode(pointsToc[i].label);
    urls.push(pointsToc[i].content);
    function makeDisplayer(i) {
      return function() {
        hide('toc');
        show('page');
        var pageFile = archive.file(urls[i]);
        var pageEl = document.getElementById('page');
        pageEl.style.width = window.innerWidth * 0.95 + "px";
        pageEl.style.height = window.innerHeight * 0.95 + "px";
        var mimeType;
        if (/.xhtml$/.test(pageFile.name)) {
          mimeType = "application/xhtml+xml";
        } else {
          mimeType = "text/html";
        }
        pageEl.src = "data:" + mimeType + "," + encodeURIComponent(pageFile.data);

        var mouseLayer = document.getElementById('mouselayer');
        mouseLayer.style.width = pageEl.clientWidth + "px";
        mouseLayer.style.height = pageEl.clientHeight + "px";
        mouseLayer.style.position = 'absolute';
        mouseLayer.style.zIndex = 99;
        mouseLayer.onclick = function(ev) {
          if (ev.screenX > window.innerWidth / 2) {
            pageEl.contentDocument.documentElement.scrollTop += pageEl.clientHeight * 0.95;
          } else {
            pageEl.contentDocument.documentElement.scrollTop -= pageEl.clientHeight * 0.95;
          }
        };
      };
    }
    el.onclick = makeDisplayer(i);
    el.appendChild(text);
    list.appendChild(el);
  }
  hide('index');
  show('toc');
}

function changeDisplay(id, display) {
  if (Array.isArray(id)) {
    for (var i = 0; i < id.length; i++) {
      changeDisplay(id[i], display);
    }
  } else {
    document.getElementById(id).style.display = display;  
  }
}

function hide(id) {
  changeDisplay(id, 'none');
}

function show(id) {
  changeDisplay(id, 'block');
}

function readFile(blob, success, error) {
  if (!error) error = oops;
  var reader = new FileReader();
  reader.onloadend = function() {
    success(reader.result);
  };
  reader.onerror = function() {
    error(reader.error);
  };
  reader.readAsBinaryString(blob);
}

function oops(error) {
  alert(error.name);
}

function log(s) {
  var el = document.createElement('div');
  el.textContent = s;
  document.getElementById('log').appendChild(el);
}

function showContents(archive) {
  //var folders = archive.folder(/^(META-INF|meta-inf)/);
  var folders = [{name: "META-INF"}, {name: "meta-info"}];
  for (var i = 0; i < folders.length; i++) {
    var file = archive.folder(folders[i].name).file("container.xml");
    if (file) {
      handleContainer(archive, file.data);
      break;
    }
  }
  
  //document.getElementById('index').style.display = 'none';
  //document.getElementById('archive').style.display = 'block';
}