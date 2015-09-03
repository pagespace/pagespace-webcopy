(function() {
    var STORAGE_KEY = 'pagespace-webcopy-html';

    angular.module('webCopyApp', [ 'ngSanitize' ])
    .directive('psWysihtml', function () {

        return {
            restrict: 'A',
            link: function (scope, element, attrs, controller) {

                localforage.getItem(STORAGE_KEY).then(function(htmlDraft) {
                    return htmlDraft ? new Promise(function(resovle) {
                        resovle({
                            html: htmlDraft
                        });
                    }) : pagespace.getData();
                }).then(function(data) {
                    scope.data = data;
                    scope.$apply();
                    setupEditor();
                });

                function setupEditor() {
                    var editorEl = element[0].querySelector('.editor');
                    var sourceEl = element[0].querySelector('.source');
                    var toolbarEl = element[0].querySelector('.toolbar');

                    angular.element(sourceEl).addClass('hidden');

                    var editor = new wysihtml5.Editor(editorEl, {
                        toolbar: toolbarEl,
                        showToolbarAfterInit: false,
                        parserRules:  wysihtml5ParserRules,
                        cleanUp: false,
                        useLineBreaks:  false
                    });
                    scope.webcopy = editor.getValue();

                    element[0].querySelector('[data-behavior=showSource]').addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var textarea = sourceEl.getElementsByTagName('textarea')[0];
                        var html;
                        if(angular.element(sourceEl).hasClass('hidden')) {
                            //show textarea
                            html = editor.getValue();
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
                        scope.webcopy = editor.getValue();
                        scope.changed = true;
                    });
                    editor.on("aftercommand", function() {
                        scope.changed = true;
                    });
                }
            }
        }
    })
    .controller('WebCopyController' , function($scope, $http) {

        $scope.changed = false;

        $scope.save = function() {
            var htmlVal = $scope.webcopy;
            return pagespace.setData({
                wrapperClass: $scope.wrapperClass || '',
                html: htmlVal
            }).then(function() {
                //remove draft
                return localforage.removeItem(STORAGE_KEY);
            }).then(function() {
                pagespace.close();
            });
        };

        $scope.saveDraft = function() {
            var htmlVal = $scope.webcopy;
            return localforage.setItem(STORAGE_KEY, htmlVal);
        };

         function saveOnChange() {
             setTimeout(function() {
                 if($scope.changed) {
                     $scope.saveDraft().then(function() {
                         console.info('Draft saved');
                         $scope.changed = false;
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
    });
})();