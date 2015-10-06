window.webcopyEditor = (function () {

    var storageKey = pagespace.getKey();

    var contentChanged = false;
    var editor = null;
    var data = null;

    function init() {

        localforage.getItem(storageKey).then(function(cachedHtml) {
            pagespace.getData().then(function(_data) {
                if(cachedHtml) {
                    _data.html = cachedHtml;
                }
                data = _data;

                setUpEditor();
                imageSelect();
                linkSelect();
                listenForChanges();
            });
        });
    }

    function setUpEditor() {

        var rootEl = document.getElementById('webcopy-editor');
        var editorEl = rootEl.querySelector('.editor');
        var sourceEl = rootEl.querySelector('.source');
        var toolbarEl = rootEl.querySelector('.toolbar');

        var openImageSelector = rootEl.querySelector('.btn-img-select');
        openImageSelector.addEventListener('click', function() {
            toolbarEl.classList.toggle('full');
        });
        var openLinkSelector = rootEl.querySelector('.btn-link-select');
        openLinkSelector.addEventListener('click', function() {
            toolbarEl.classList.toggle('full');
        });

        toolbarEl.querySelector('[data-wysihtml5-command="insertImage"]').addEventListener('click', function() {
            toolbarEl.querySelector('[data-wysihtml5-dialog="createLink"]').style.display = 'none';
        });
        toolbarEl.querySelector('[data-wysihtml5-command="createLink"]').addEventListener('click', function() {
            toolbarEl.querySelector('[data-wysihtml5-dialog="insertImage"]').style.display = 'none';
        });

        sourceEl.classList.add('hidden');

        editor = new wysihtml5.Editor(editorEl, {
            toolbar: toolbarEl,
            showToolbarAfterInit: false,
            parserRules:  wysihtml5ParserRules,
            cleanUp: true,
            useLineBreaks:  false,
            stylesheets: data.cssHref ?  [ data.cssHref ] : []
        });

        editor.setValue(data.html);

        rootEl.querySelector('[data-behavior=showSource]').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var textarea = sourceEl.getElementsByTagName('textarea')[0];
            var html;
            if(sourceEl.classList.contains('hidden')) {
                //show textarea
                html = editor.getValue(false);
                textarea.value = html;
            } else {
                // show editor
                html = textarea.value;
                editor.setValue(html);
            }

            editorEl.classList.toggle('hidden');
            sourceEl.classList.toggle('hidden');
        });

        editor.on("focus", function() {
            toolbarEl.classList.remove('hidden');
        });
        editor.on("interaction", function() {
            contentChanged = true;
        });
        editor.on("aftercommand", function() {
            contentChanged = true;
        });
        editor.on("cancel:dialog", function() {
            toolbarEl.classList.remove('full');
        });
        editor.on("save:dialog", function() {
            toolbarEl.classList.remove('full');
        });

        document.querySelector('[data-wysihtml5-dialog="createLink"] [data-wysihtml5-dialog-action="save"]').addEventListener('click', function() {
            toolbarEl.classList.remove('full');
        });
        document.querySelector('[data-wysihtml5-dialog="insertImage"] [data-wysihtml5-dialog-action="save"]').addEventListener('click', function() {
            toolbarEl.classList.remove('full');
        });
    }

    function imageSelect() {

        fetch('/_api/media?type=' + encodeURIComponent('/^image/'), {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(checkStatus)
            .then(parseJSON)
            .then(function(images) {
            images = images.map(function(image) {
                image.src = '/_media/' + image.fileName;
                return image;
            });

            var listGroup = document.createElement('a');
            listGroup.classList.add('list-group');
            images.map(function(image) {
                var html =
                    '<div class=image-holder>' +
                    '<img src=' + image.src + '>' +
                    '</div>' +
                    '<h4 class=list-group-item-heading>' + image.name + '</h4>' +
                    '<div class=clearfix></div>';
                var listItem = document.createElement('a');
                listItem.classList.add('list-group-item');
                listItem.innerHTML = html;
                listItem.addEventListener('click', function() {
                    var src =  document.querySelector('[data-wysihtml5-dialog-field="src"]');
                    src.focus();
                    src.value = image.src;
                    document.querySelector('[data-wysihtml5-dialog-field="width"]').value = image.width;
                    document.querySelector('[data-wysihtml5-dialog-field="height"]').value = image.height;
                    document.querySelector('[data-wysihtml5-dialog-field="alt"]').value = image.name;
                });
                return listItem;
            }).forEach(function(listItem) {
                listGroup.appendChild(listItem);
            });

            document.getElementById('image-lookup').appendChild(listGroup);
        });
    }

    function linkSelect() {

        fetch('/_api/pages?status=200', {
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json'
            }
        })
            .then(checkStatus)
            .then(parseJSON)
            .then(function(pages) {
            var listGroup = document.createElement('a');
            listGroup.classList.add('list-group');
            pages.map(function(page) {
                var html = '<h4 class=list-group-item-heading>' + page.name + '<small>' + page.url + '</small></h4>';
                var listItem = document.createElement('a');
                listItem.classList.add('list-group-item');
                listItem.innerHTML = html;
                listItem.addEventListener('click', function() {
                    var input = document.querySelector('[data-wysihtml5-dialog-field="href"]');
                    input.focus();
                    input.value = page.url;

                });
                return listItem;
            }).forEach(function(listItem) {
                listGroup.appendChild(listItem);
            });

            document.getElementById('page-lookup').appendChild(listGroup);
        });
    }

    function listenForChanges() {

        function save() {
            var htmlVal = editor.getValue();
            return pagespace.setData({
                wrapperClass: data.wrapperClass || '',
                cssHref: data.cssHref,
                html: htmlVal
            }).then(function() {
                //remove draft
                return localforage.removeItem(storageKey);
            }).then(function() {
                pagespace.close();
            });
        }

        document.getElementById('btnSave').addEventListener('click', function() {
            save();
        });

        function saveDraft() {
            var htmlVal = editor.getValue();
            return localforage.setItem(storageKey, htmlVal);
        }

        function saveOnChange() {
            setTimeout(function() {
                if(contentChanged) {
                    saveDraft().then(function() {
                        console.info('Draft saved');
                        ///$scope.lastSaveTime = Date.now();
                        contentChanged = false;
                        saveOnChange();
                    }).catch(function(err) {
                         console.error(err, 'Error saving draft');
                    });
                } else {
                    saveOnChange();
                }
             }, 500);
        }
        saveOnChange();
    }

    function checkStatus(response) {
        if (response.status >= 200 && response.status < 300) {
            return response
        } else {
            var error = new Error(response.statusText)
            error.response = response
            throw error
        }
    }

    function parseJSON(response) {
        return response.json()
    }

    return init();
})();