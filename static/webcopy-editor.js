(function() {

    var storageKey = null;

    angular.module('webCopyApp', [ 'ngSanitize' ])
    .directive('psWysihtml', function () {

        return {
            restrict: 'A',
            link: function (scope, element) {

                localforage.getItem(storageKey).then(function(cachedHtml) {
                    pagespace.getData().then(function(data) {
                        if(cachedHtml) {
                            data.html = cachedHtml;
                        }
                        if(data.cssHref) {
                            var injectLink = document.createElement('link');
                            injectLink.setAttribute('type', 'text/css');
                            injectLink.setAttribute('rel', 'stylesheet');
                            injectLink.setAttribute('href', data.cssHref);
                            var head = document.getElementsByTagName("head")[0];
                            head.appendChild(injectLink);
                        }
                        scope.data = data;
                        scope.$apply();
                        setupEditor();
                    });
                });

                function setupEditor() {

                    var rootEl = element[0];
                    var editorEl = rootEl.querySelector('.editor');
                    var sourceEl = rootEl.querySelector('.source');
                    var toolbarEl = rootEl.querySelector('.toolbar');

                    var openImageSelector = rootEl.querySelector('.btn-img-select');
                    openImageSelector.addEventListener('click', function() {
                        angular.element(toolbarEl).toggleClass('full');
                    });
                    var openLinkSelector = rootEl.querySelector('.btn-link-select');
                    openLinkSelector.addEventListener('click', function() {
                        angular.element(toolbarEl).toggleClass('full');
                    });

                    toolbarEl.querySelector('[data-wysihtml5-command="insertImage"]').addEventListener('click', function() {
                        toolbarEl.querySelector('[data-wysihtml5-dialog="createLink"]').style.display = 'none';
                    });
                    toolbarEl.querySelector('[data-wysihtml5-command="createLink"]').addEventListener('click', function() {
                        toolbarEl.querySelector('[data-wysihtml5-dialog="insertImage"]').style.display = 'none';
                    });

                    angular.element(sourceEl).addClass('hidden');

                    var editor = new wysihtml5.Editor(editorEl, {
                        toolbar: toolbarEl,
                        showToolbarAfterInit: false,
                        parserRules:  wysihtml5ParserRules,
                        cleanUp: false,
                        useLineBreaks:  false
                    });

                    scope.webcopy = editor.getValue(false);

                    rootEl.querySelector('[data-behavior=showSource]').addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var textarea = sourceEl.getElementsByTagName('textarea')[0];
                        var html;
                        if(angular.element(sourceEl).hasClass('hidden')) {
                            //show textarea
                            html = editor.getValue(false);
                            angular.element(textarea).val(html);
                        } else {
                            // show editor
                            html = angular.element(textarea).val();
                            editor.setValue(html);
                        }

                        angular.element(editorEl).toggleClass('hidden');
                        angular.element(sourceEl).toggleClass('hidden');
                    });

                    editor.on("focus", function() {
                        angular.element(toolbarEl).removeClass('hidden');
                    });
                    /*            editor.on("blur", function() {
                     angular.element(toolbarEl).addClass('hidden');
                     });*/
                    editor.on("interaction", function() {
                        scope.webcopy = editor.getValue(false);
                        scope.changed = true;
                    });
                    editor.on("aftercommand", function() {
                        scope.changed = true;
                    });
                    editor.on("cancel:dialog", function() {
                        angular.element(toolbarEl).removeClass('full');
                    });
                    editor.on("save:dialog", function() {
                        angular.element(toolbarEl).removeClass('full');
                    });

                }
            }
        }
    })
    .directive('psImageDialog', function() {
        return {
            restrict: 'A',
            controller: function($scope, $http) {
                $http.get('/_api/media?type=' + encodeURIComponent('/^image/')).success(function(images) {
                    images = images.map(function(image) {
                        image.src = '/_media/' + image.fileName;
                        return image;
                    });
                    $scope.availableImages = images;
                });

                $scope.selectImage = function(image) {
                    console.log(image);
                    document.querySelector('[data-wysihtml5-dialog-field="src"]').value = '/_media/' + image.fileName;
                    document.querySelector('[data-wysihtml5-dialog-field="width"]').value = image.width;
                    document.querySelector('[data-wysihtml5-dialog-field="height"]').value = image.height;
                    document.querySelector('[data-wysihtml5-dialog-field="alt"]').value = image.name;
                };
            }
        }
    })
    .directive('psLinkDialog', function() {
        return {
            restrict: 'A',
            controller: function($scope, $http) {
                $http.get('/_api/pages?status=' + encodeURIComponent('200')).success(function(pages) {
                    $scope.availablePages = pages;
                });

               $scope.selectPage = function(page) {
                    document.querySelector('[data-wysihtml5-dialog-field="href"]').value = page.url;
               };
            }
        }
    })
    .controller('WebCopyController' , function($scope) {

        storageKey = pagespace.getKey();

        $scope.changed = false;
        $scope.lastSaveTime = Date.now();

        $scope.save = function() {
            var htmlVal = $scope.webcopy;
            return pagespace.setData({
                wrapperClass: $scope.data.wrapperClass || '',
                cssHref: $scope.data.cssHref,
                html: htmlVal
            }).then(function() {
                //remove draft
                return localforage.removeItem(storageKey);
            }).then(function() {
                pagespace.close();
            });
        };

        $scope.saveDraft = function() {
             var htmlVal = $scope.webcopy;
             return localforage.setItem(storageKey, htmlVal);
        };

        function saveOnChange() {
            setTimeout(function() {
                if($scope.changed) {
                    $scope.saveDraft().then(function() {
                        console.info('Draft saved');
                        $scope.lastSaveTime = Date.now();
                        $scope.changed = false;
                        saveOnChange();
                        $scope.$apply();
                    }).catch(function(err) {
                         console.error(err, 'Error saving draft');
                    });
                } else {
                    saveOnChange();
                }
             }, 500);
        }
        saveOnChange();
    });
})();