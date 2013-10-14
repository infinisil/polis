define([
  'templates/conversationGatekeeper',
  // 'views/userCreateView',
  'views/metadataQuestionsView',
  'collections/MetadataQuestions',
  'util/polisStorage',
  'view',
], function (
  template,
  // UserCreateView,
  MetadataQuestionsView,
  MetadataQuestionCollection,
  PolisStorage,
  View
) {
  return View.extend({
    name: 'conversationGatekeeper',
    template: template,
    events: {
      "submit form": function(event){
        var that = this;
        event.preventDefault();
        var urlPrefix = "http://api.polis.io/";
        if (-1 === document.domain.indexOf(".polis.io")) {
            urlPrefix = "http://localhost:5000/";
        }
        this.serialize(function(attrs, release){
          // Incorporate options, like zinvite.
          attrs = $.extend(that.options || {}, attrs);

          $.ajax({
            url: urlPrefix + "v3/auth/new",
            type: "POST",
            dataType: "json",
            xhrFields: {
                withCredentials: true
            },
            crossDomain: true,
            data: attrs
          }).then(function(data) { 
            PolisStorage.uid.set(data.uid);
            PolisStorage.email.set(data.email);
            release();
            that.trigger("done");
          }, function(err) {
            release();
            alert("login was unsuccessful");
          });
        })
      },
    },
    initialize: function(options) {

      this.options = options;
      var zid = options.zid;
      var zinvite = options.zinvite;

      var metadataCollection = new MetadataQuestionCollection([], {
        zid: zid,
      });

      metadataCollection.fetch({
          data: $.param({
              zid: zid,
              zinvite: zinvite,
          }), 
          processData: true,
      });
      this.metadataQuestionsView = new MetadataQuestionsView({
        collection: metadataCollection,
        zid: zid,
        zinvite: zinvite,
      });

      // this.gatekeeperAuthView = new UserCreateView({
      //   zinvite: zinvite,
      // });
    },
  });
});
