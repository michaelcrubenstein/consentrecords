var WordcloudPathsResultsView = (function () {
	WordcloudPathsResultsView.prototype = Object.create(SearchOptionsView.prototype);
	WordcloudPathsResultsView.prototype.constructor = WordcloudPathsResultsView;

	WordcloudPathsResultsView.prototype.panel = null;
	
	WordcloudPathsResultsView.prototype.inputText = function(val)
	{
		return "";
	}
		
	WordcloudPathsResultsView.prototype.containsQuery = function(fc, queryServices) {
		var offering = fc.experience.offering();
		if (offering && offering.id())
		{
			var services = offering.offeringServices();
			/* services may be null if the experience references an offering in an
				organization that isn't public. This typically occurs in testing
				when the organization wasn't made public.
			 */
			if (services && services.findIndex(function(s)
				{
					return queryServices.findIndex(function(qs)
						{
							return s.service().serviceImplications().findIndex(function(s2)
								{
									return qs.id() == s2.service().id();
								}) >= 0;
						}) >= 0;
				}) >= 0)
				return true;
		}
		
		if (fc.experience instanceof cr.Experience)
		{
			var services = fc.experience.experienceServices();
			if (services)
			{
				if (services.findIndex(function(s) {
						return queryServices.findIndex(function(qs)
						{
							return s.service().serviceImplications().findIndex(function(s2)
								{
									return qs.id() == s2.service().id();
								}) >= 0;
						}) >= 0;
					}) >= 0)
					return true;
			}
		}
		return false;
	}
	
	WordcloudPathsResultsView.prototype.onClickButton = function(d, i) {
		var _this = this;
		
		if (prepareClick('click', 'search result path'))
		{
			showPath(d, this.panel.node())
				.then(function(panel)
					{
						$(panel.pathtree).on("userSet.cr", function()
							{
								panel.pathtree.flagControllers().forEach(function(fc)
									{
										fc.selected(_this.containsQuery(fc, _this.panel.queryServices));
									});
							});
					});
		}
		d3.event.preventDefault();
	}
	
	WordcloudPathsResultsView.prototype.isButtonVisible = function(button, d, compareText)
	{
		return true;
	}
	
	WordcloudPathsResultsView.prototype.noResultString = function()
	{
		return "No Results";
	}
	
	WordcloudPathsResultsView.prototype.textCleared = function()
	{
		/* Do nothing */
	}
	
	WordcloudPathsResultsView.prototype.textChanged = function()
	{
		/* Do nothing */
	}
	
	WordcloudPathsResultsView.prototype.searchPath = function(val)
	{
		return this.panel.path;
	}
	
	WordcloudPathsResultsView.prototype.appendSearchArea = function()
	{
		return this.sectionView.appendItemList()
			.classed('hover-items search', true);
	}
	
	/* Overwrite this function to use a different set of fields for the getData or selectAll operation
		sent to the middle tier.
	 */
	WordcloudPathsResultsView.prototype.fields = function()
	{
		return ['parents', 'user'];
	}
	
	WordcloudPathsResultsView.prototype.resultType = function()
	{
		return cr.Path;
	}
	
	function WordcloudPathsResultsView(sectionView, panel)
	{
		if (!panel)
			throw new Error("panel is not specified");

		this.panel = panel;
		SearchOptionsView.call(this, sectionView);
	}
	
	return WordcloudPathsResultsView;
})();

var WordcloudPathsPanel = (function () {
	WordcloudPathsPanel.prototype = Object.create(crv.SitePanel.prototype);
	WordcloudPathsPanel.prototype.constructor = WordcloudPathsPanel;

	function WordcloudPathsPanel(path, queryServices, title, onShow)
	{
		crv.SitePanel.call(this);
		var _this = this;
		this.path = path;
		this.queryServices = queryServices;
		
		this.createRoot(null, title, "view wordcloud-paths");

		var navContainer = this.appendNavContainer();

		var _this = this;
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(title);
		
		this.appendScrollArea();
		
		this.sectionView = new UserSectionView(this)
			.classed('results-container', true);
		this.resultContainerNode = this.sectionView.node();
			
		setTimeout(function()
			{
				_this.pathResultsView = new WordcloudPathsResultsView(_this.sectionView, _this);
				_this.pathResultsView.startSearchTimeout("", 0);
			});
	}
	
	return WordcloudPathsPanel;
	
})();

var OfferingWordcloudPanel = (function()
{
	OfferingWordcloudPanel.prototype = Object.create(crv.SitePanel.prototype);
	OfferingWordcloudPanel.prototype.constructor = OfferingWordcloudPanel;

	OfferingWordcloudPanel.prototype.parent = null;
	
	OfferingWordcloudPanel.prototype.showPaths = function(path)
	{
		var queryServices = [];
		if (this.serviceID)
			queryServices = [crp.getInstance(this.serviceID)];
			
		var panel = new WordcloudPathsPanel(path, queryServices, this.offering.description(), revealPanelLeft);
		panel.showLeft()
			.then(unblockClick);
	}
	
	function OfferingWordcloudPanel(offering, reveal)
	{
		crv.SitePanel.call(this);
		this.createRoot(parent, offering.description(), 'view wordcloud');

		var navContainer = this.appendNavContainer();

		var _this = this;
		this.offering = offering;
		
		var backButton = navContainer.appendLeftButton()
			.on('click', function() { _this.hide(); });
		backButton.append('span').text(crv.buttonTexts.done);

		navContainer.appendTitle(offering.description());
		
		this.appendScrollArea();
		this.path = 'offering/{0}/session/engagement/user/path'.format(offering.id());
		this.serviceID = null;
		
		this.appendActionButton(
			"Paths",
			function(organization)
			{
				if (prepareClick('click', 'Paths'))
				{
					if (_this.serviceID)
						_this.showPaths(_this.path + '[experience>implication>service={0}]'.format(_this.serviceID));
					else
						_this.showPaths(_this.path);
				}
			})
			.classed('first', true);
		
		var cloudNode = this.mainDiv.append('section')
			.classed('wordcloud', true)
			.node();
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
			_this.serviceID = this.getAttribute('serviceID');
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

