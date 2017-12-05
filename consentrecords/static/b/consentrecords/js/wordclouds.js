var OfferingWordcloudPanel = (function()
{
	OfferingWordcloudPanel.prototype = Object.create(crv.SitePanel.prototype);
	OfferingWordcloudPanel.prototype.constructor = OfferingWordcloudPanel;

	OfferingWordcloudPanel.prototype.parent = null;
	function OfferingWordcloudPanel(offering, reveal)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, offering.description(), 'view');

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(offering.description());
		
		this.appendScrollArea();
		this.path = 'offering/{0}/session/engagement/user/path'.format(offering.id());
		
		var cloudNode = this.mainDiv.node();
		function showWords(words, update)
		{
			words.forEach(function(w)
				{
					var service = crp.getInstance(w.id);
					w.text = service.description();
					w.color = service.getColor();
					w.handlers = {click: filterPaths};
					w.html={serviceID: w.id}
				});
			if (update)
				{
					$(cloudNode).jQCloud('update', words);
				}
			else
			{
				$(cloudNode).jQCloud(words,
					{autoResize: true});
			}
		}
		
		function updateWords(words)
		{
			return showWords(words, true);
		}
		
		function filterPaths()
		{
			return cr.getFollowingCounts(_this.path, 'service/{0}'.format(this.getAttribute('serviceID')))
				.then(updateWords, cr.asyncFail);
		}
		
		cr.Service.servicesPromise()
			.then(function(services)
				{
					return cr.getServiceCounts(_this.path)
						.then(showWords, cr.asyncFail);
				},
				cr.asyncFail);
	}
	
	return OfferingWordcloudPanel;
})();

