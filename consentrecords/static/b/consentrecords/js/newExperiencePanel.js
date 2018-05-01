var MultiTypeOptionView = (function() {
	MultiTypeOptionView.prototype = Object.create(SearchOptionsView.prototype);
	MultiTypeOptionView.prototype.constructor = MultiTypeOptionView;

	MultiTypeOptionView.prototype.containerNode = null;
	MultiTypeOptionView.prototype.experienceController = null;
	MultiTypeOptionView.prototype.typeName = "";
	MultiTypeOptionView.prototype.initialTypeName = "";
	
	MultiTypeOptionView.prototype.hasNamedButton = function(compareText)
	{
		if (compareText.length === 0)
			return true;
		var data = this.buttons().data();
		return data.find(function(d) {
				console.assert(d.names());
				return d.names().find(
					function(d) { return d.text().toLocaleLowerCase() === compareText;}) ||
					(d.description && d.description().toLocaleLowerCase() === compareText);
			});
	}
	
	MultiTypeOptionView.prototype.stringContains = function(source, target)
	{
		return source.toLocaleLowerCase().search(new RegExp("\\b{0}".format(RegExp.escape(target)))) >= 0;
	}
	
	/* Returns true if the specified datum has a name that contains compareText. */
	MultiTypeOptionView.prototype.isMatchingDatum = function(d, compareText)
	{
		if (compareText.length === 0)
			return true;
		
		console.assert(d.description)
		return this.stringContains(d.description(), compareText);
	}
	
	MultiTypeOptionView.prototype.canConstrain = function(searchText, constrainText)
	{
		/* Force searching if the searchText length is 0. */
		if (!searchText)
			return false;
			
		return SearchOptionsView.prototype.canConstrain.call(this, searchText, constrainText);
	}
	
	MultiTypeOptionView.prototype.restartSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.restartSearchTimeout.call(this, val);
	}
				
	MultiTypeOptionView.prototype.startSearchTimeout = function(val)
	{
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.startSearchTimeout.call(this, val);
	}
				
	MultiTypeOptionView.prototype.search = function(val)
	{
		if (!this.initialTypeName || !this.initialTypeName.length)
			throw "unset initialTypeName";
			
		this.typeName = this.initialTypeName;
		SearchOptionsView.prototype.search.call(this, val);
	}
	
	MultiTypeOptionView.prototype.appendSearchArea = function()
	{
		return crf.appendItemList(d3.select(this.containerNode))
			.classed('hover-items search', true);
	}
	
	function MultiTypeOptionView(sectionView, containerNode, experienceController)
	{
		this.containerNode = containerNode;
		if (containerNode)
		{
			console.assert(experienceController);
			console.assert(experienceController instanceof ExperienceController);

			this.experienceController = experienceController;
		}
		SearchOptionsView.call(this, sectionView)
	}
	
	return MultiTypeOptionView;
	
})();

var ExperienceDatumSearchView = (function() {
	ExperienceDatumSearchView.prototype = Object.create(MultiTypeOptionView.prototype);
	ExperienceDatumSearchView.prototype.constructor = ExperienceDatumSearchView;

	ExperienceDatumSearchView.prototype.typeNames = null;
	ExperienceDatumSearchView.prototype.initialTypeName = null;
	ExperienceDatumSearchView.prototype.typeName = null;
	ExperienceDatumSearchView.prototype.sitePanel = null;
	
	ExperienceDatumSearchView.prototype.inputBox = null;
	ExperienceDatumSearchView.prototype.helpNode = null;
	
	ExperienceDatumSearchView.prototype.reveal = null;
	ExperienceDatumSearchView.prototype.minRevealHeight = 100;	/* pixels */

	ExperienceDatumSearchView.prototype.inputText = function(val)
	{
		if (val === undefined)
			return this.inputBox.value.trim();
		else
		{
			this.inputBox.value = val;
			$(this.inputBox).trigger("input");
		}
	}
	
	ExperienceDatumSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d instanceof cr.Service)
		{
			if (prepareClick('click', 'service: ' + d.description()))
			{
				if (!this.experienceController.offeringName() &&
					this.experienceController.experienceServices().find(function(es)
						{
							return es.service().id() == d.id();
						}))
					this.experienceController.customOffering(d.description())
								   .offering(null);
				else
					this.experienceController.addService(d);
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		else if (d instanceof cr.Organization)
		{
			if (prepareClick('click', 'organization: ' + d.description()))
			{
				try
				{
					/* Clear the site and offering if they aren't within the new organization. */
					this.experienceController.organizationPicked(d);
					
					this.sitePanel.onExperienceUpdated();
					this.hideSearch(function()
						{
							_this.cancelSearch();
							var newInputNode = _this.sitePanel.siteInput.node();
							newInputNode.focus();
							newInputNode.setSelectionRange(0, newInputNode.value.length);
							unblockClick();
						});
				}
				catch(err)
				{
					cr.syncFail(err);
				}
			}
		}
		else if (d instanceof cr.Site)
		{
			if (prepareClick('click', 'site: ' + d.description()))
			{
				/* Need to check the cells in case this site was a value within an offering. */
				d.promiseData(['address', 'parents'])
					.then(function()
						{
							try
							{
								_this.experienceController.sitePicked(d);
								_this.sitePanel.onExperienceUpdated();
								_this.hideSearch(function()
									{
										_this.cancelSearch();
										var newInputNode = _this.sitePanel.offeringInput.node();
										newInputNode.focus();
										newInputNode.setSelectionRange(0, newInputNode.value.length);
										unblockClick();
									});
							}
							catch(err)
							{
								cr.syncFail(err);
							}
						},
						cr.syncFail);
			}
		}
		else if (d instanceof cr.Offering)
		{
			if (prepareClick('click', 'offering: ' + d.description()))
			{
				this.experienceController.offeringPicked(d);
				this.sitePanel.onExperienceUpdated();
				_this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		d3.event.preventDefault();
	}
	
	ExperienceDatumSearchView.prototype.hasUniqueSite = function(d)
	{
		var compareText = d.description();
	
		var data = this.buttons().data();
		return data.find(function(d) {
				return d instanceof cr.Site &&
					   d.description() === compareText &&
					   d.organization().description() === compareText;
			});
	}
	
	ExperienceDatumSearchView.prototype.fields = function(compareText)
	{
		var resultType = this.resultType(compareText);
		if (resultType == cr.Site)
			return ['parents', 'address'];
		else if (resultType == cr.Offering)
			return ['parents', 'services'];
		else
			return ['parents'];
	}
	
	ExperienceDatumSearchView.prototype.isButtonVisible = function(button, d, compareText)
	{
		/* Do not display organizations if there is a site with the same name. */
		if (d instanceof cr.Organization &&
			this.hasUniqueSite(d))
			return false;
		
		if (this.isMatchingDatum(d, compareText))
			return true;

		if (d instanceof cr.Offering)
		{
			console.assert(d.organization());
			console.assert(d.site());
			if (this.stringContains(d.site().description(), compareText))
				return true;
			if (this.stringContains(d.organization().description(), compareText))
				return true;
		}
		else if (d instanceof cr.Site)
		{
			console.assert(d.organization());
			if (this.stringContains(d.organization().description(), compareText))
				return true;
		}
		return false;
	}
	
	ExperienceDatumSearchView.prototype.noResultString = function()
	{
		return "";
	}
	
	ExperienceDatumSearchView.prototype.textCleared = function()
	{
		SearchOptionsView.prototype.textCleared.call(this);
		
		this.startSearchTimeout("");
	}
	
	ExperienceDatumSearchView.prototype.startSearchTimeout = function(searchText)
	{
		this.setupSearchTypes(searchText);
		this.showSearch();
		if (this.typeName)
			SearchOptionsView.prototype.startSearchTimeout.call(this, searchText);
	}
				
	ExperienceDatumSearchView.prototype.restartSearchTimeout = function(val)
	{
		val = val !== undefined ? val : this.inputCompareText();
		this.setupSearchTypes(val);
		this.showSearch();
		if (this.typeName)
			SearchOptionsView.prototype.restartSearchTimeout.call(this, val);
		else
			/* Clear away any previously found items. */
			this.cancelSearch();
	}
	
	ExperienceDatumSearchView.prototype.isSearchVisible = function()
	{
		return $(this.helpNode).css('display') != 'none';
	}
	
	ExperienceDatumSearchView.prototype.hideSearch = function(done)
	{
		var _this = this;

		var jHelpDiv = $(_this.helpNode);
		jHelpDiv.children().remove();
		jHelpDiv.css('display', 'none');
		this.reveal.hide({duration: 200,
						  before: done});
	}
	
	ExperienceDatumSearchView.prototype.showSearch = function(duration, step, done)
	{
		duration = duration !== undefined ? duration : 400;
		var parent = $(this.reveal.node).parent();
		var oldHeight = $(this.reveal.node).height();
		$(this.reveal.node).height(0);
		
		var newHeight = parent.getFillHeight() - 
						parent.outerHeight(true);
		if (this.minRevealHeight > newHeight)
			newHeight = this.minRevealHeight;
			
		$(this.reveal.node).height(oldHeight);
		if (oldHeight != newHeight)
		{
			this.reveal.show(
				/* To calculate the new height, get the fill height of the parent (the height of its parent minus the height of all other nodes)
					and subtract the parent's height and add back the reveal node's height. */
				{newHeight: newHeight,
				 children: $(this.listElement.node())},
				duration, step, done);
		}
	}
	
	ExperienceDatumSearchView.prototype.resizeVisibleSearch = function(duration)
	{
		if (this.reveal.isVisible())
		{
			this.showSearch(duration);
			return true;
		}
		else
			return false;
	}

	function ExperienceDatumSearchView(sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		console.assert(containerNode);
		
		this.typeNames = [""];
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.initialTypeName;
		this.sitePanel = sitePanel;
		MultiTypeOptionView.call(this, sectionView, containerNode, experienceController);
		
		var _this = this;

		this.inputBox = inputNode;
		$(this.inputBox).on('input', function() { 
				try { _this.textChanged(); }
				catch(err) { cr.asyncFail(err); }
			});
		
		this.helpNode = helpNode;

		this.reveal = new VerticalReveal(containerNode);
		this.reveal.hide();

		this.getDataChunker._onDoneSearch = function()
			{
				var i = _this.typeNames.indexOf(_this.typeName);
				if (i < _this.typeNames.length - 1)
				{
					_this.typeName = _this.typeNames[i+1];
					_this.setupChunkerArguments(_this._foundCompareText);
					this.checkStart(_this._foundCompareText);
				}
			};
	}
	
	return ExperienceDatumSearchView;
})();

var OrganizationLinkSectionView = (function() {
	OrganizationLinkSectionView.prototype = Object.create(crv.SectionView.prototype);
	OrganizationLinkSectionView.prototype.constructor = OrganizationLinkSectionView;
	
	OrganizationLinkSectionView.prototype.appendDescription = function(div, d)
	{
		if (d instanceof cr.Site)
		{
			/* The organization name is either a value of d or, if d is a value
			   of an Offering, then the organization name is the value of the offering.
			 */
			var orgValue;
			if (d.parent() && d.parent() instanceof cr.Offering)
				orgValue = d.parent.organization();
			else
				orgValue = d.organization();
				
			if (orgValue.description() == d.description())
			{
				div.textContent = d.description();
			}
			else
			{
				orgDiv = d3.select(div).append('div').classed('organization', true);		
				orgDiv.append('div').text(orgValue.description());
				orgDiv.append('div')
					.classed('address-line', true)
					.text(d.description());
			}
		}
		else
		{
			div.textContent = d.description();
		}
	}
	
	function OrganizationLinkSectionView(sitePanel)
	{
		crv.SectionView.call(this, sitePanel);
		this.classed('cell picker organization', true);
	}
	
	return OrganizationLinkSectionView;
})();

/* Displays site or organization */
var OrganizationLinkSearchView = (function() {
	OrganizationLinkSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	OrganizationLinkSearchView.prototype.constructor = OrganizationLinkSearchView;

	OrganizationLinkSearchView.prototype.clearFromOrganization = function()
	{
		if (this.experienceController.organization())
		{
			if (this.experienceController.offering())
			{
				this.experienceController.clearOffering();
				this.experienceController.clearSite();
				this.experienceController.clearOrganization();
			}
			else if (this.experienceController.site())
			{
				this.experienceController.clearSite();
				this.experienceController.clearOrganization();
			}
			else
			{
				this.experienceController.clearOrganization();
			}
		}
		else
		{
			this.experienceController.clearOrganization();
		}
	}
	
	OrganizationLinkSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (val)
		{
			if (this.typeName === "Site")
			{
				path = 'site[name>text*="{0}"|organization>name>text*="{0}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'organization[name>text*="{0}"]';
			}
		
			return path.format(encodeURIComponent(val));
		}
		else
			return '';
	}
	
	OrganizationLinkSearchView.prototype.resultType = function(val)
	{
		var path;
		if (val)
		{
			if (this.typeName === "Site")
			{
				return cr.Site;
			}
			else if (this.typeName === "Organization")
			{
				return cr.Organization;
			}
			else
				throw new Error("unexpected typeName");
		}
		else
			return null;
	}
	
	OrganizationLinkSearchView.prototype.setupSearchTypes = function(searchText)
	{
		if (searchText)
		{
			this.typeNames = ["Organization", "Site", ];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	OrganizationLinkSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.organizationName() || "");
	}
	
	function OrganizationLinkSearchView(sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return OrganizationLinkSearchView;
})();

var SiteLinkSectionView = (function() {
	SiteLinkSectionView.prototype = Object.create(crv.SectionView.prototype);
	SiteLinkSectionView.prototype.constructor = SiteLinkSectionView;
	
	SiteLinkSectionView.prototype.appendDescription = function(div, d)
	{
		var leftText = d3.select(div);
		
		if (d instanceof cr.Offering)
		{
			leftText.append('div')
				.classed('title', true).text(d.description());

			var orgDiv = leftText.append('div')
				.classed('organization', true);
			orgDiv.append('div')
				.classed('address-line', true)
				.text(d.organization().description());
				
			if (d.site().description() != d.organization().description())
			{
				orgDiv.append('div')
					.classed('address-line', true)
					.text(d.site().description());
			}
		}
		else if (d instanceof cr.Site)
		{
			/* The organization name is either a value of d or, if d is a value
			   of an Offering, then the organization name is the value of the offering.
			 */
			var orgValue;
			if (d.parent() && d.parent() instanceof cr.Offering)
				orgValue = d.parent().organization();
			else
				orgValue = d.organization();
				
			if (orgValue.description() == d.description() ||
				orgValue.id() == (this.sitePanel.controller().organization() && 
				                  this.sitePanel.controller().organization().id()))
			{
				div.textContent = d.description();
			}
			else
			{
				orgDiv = leftText.append('div').classed('organization', true);		
				orgDiv.append('div').text(orgValue.description());
				orgDiv.append('div')
					.classed('address-line', true)
					.text(d.description());
			}
		}
		else
		{
			div.textContent = d.description();
		}
	}
	
	function SiteLinkSectionView(sitePanel)
	{
		crv.SectionView.call(this, sitePanel);
		this.classed('cell picker site', true);
	}
	
	return SiteLinkSectionView;
})();

/* Displays organization, site, offering */
var SiteLinkSearchView = (function() {
	SiteLinkSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	SiteLinkSearchView.prototype.constructor = SiteLinkSearchView;

	SiteLinkSearchView.prototype.clearFromSite = function()
	{
		if (this.experienceController.site())
		{
			if (this.experienceController.offering())
			{
				this.experienceController.clearOffering();
				this.experienceController.clearSite();
			}
			else
			{
				this.experienceController.clearSite();
			}
		}
		else
		{
			this.experienceController.clearSite();
		}
	}
	
	SiteLinkSearchView.prototype.searchPath = function(val)
	{
		var path;
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization() == null)
			{
				return "";
			}
			else if (!val)
			{
				if (this.typeName === 'Site')
					return this.experienceController.organization().urlPath() + '/site';
				else if (this.typeName === 'Offering from Site')
				{
					path = this.experienceController.organization().urlPath() + '/site/offering';
					path += this.experienceController.getOfferingConstraint();
					return path;
				}
			}
			else
			{
				if (this.typeName === 'Offering')
				{
					path = '[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path = this.experienceController.organization().urlPath() + '/site/offering' + path;
					path += this.experienceController.getOfferingConstraint();
				}
				else if (this.typeName === 'Site')
				{
					path = this.experienceController.organization().urlPath() + '/site[name>text*="{1}"]';
				}
			
				var symbol = "*=";
			
				return path.format(symbol, encodeURIComponent(val));
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (!val)
			{
				return "";
			}
			else
			{
				if (this.typeName === "Offering")
				{
					path = 'offering[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path += this.experienceController.getOfferingConstraint();
				}
				else if (this.typeName === 'Site')
				{
					path = 'site[name>text*="{1}"]|[organization>name>text*="{1}"]';
					if (this.experienceController.experienceServices[0] instanceof cr.Service)
					{
						path += '[offering>service>service={0}]]'.format(this.experienceController.experienceServices[0].service().id());
					}
				}
				else if (this.typeName === "Organization")
				{
					path = 'organization[name>text*="{1}"]';
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = "*=";
			
				return path.format(symbol, val);
			}
		}
		else if (val)
		{
			if (this.typeName === 'Site')
			{
				path = 'site[name>text*="{1}"]|[organization>name>text*="{1}"]';
			}
			else if (this.typeName === "Organization")
			{
				path = 'organization[name>text*="{1}"]';
			}
			var symbol = "*=";
		
			return path.format(symbol, val);
		}
		else
			return '';
	}
	
	SiteLinkSearchView.prototype.resultType = function(val)
	{
		var path;
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization() == null)
			{
				return null;
			}
			else if (!val)
			{
				if (this.typeName === 'Site')
					return cr.Site;
				else if (this.typeName === "Offering from Site")
				{
					return cr.Offering;
				}
			}
			else
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else if (this.typeName === 'Site')
				{
					return cr.Site;
				}
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (!val)
			{
				return null;
			}
			else
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else if (this.typeName === 'Site')
				{
					return cr.Site;
				}
				else if (this.typeName === "Organization")
				{
					return cr.Organization;
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			}
		}
		else if (val)
		{
			if (this.typeName === 'Site')
			{
				return cr.Site;
			}
			else if (this.typeName === 'Organization')
			{
				return cr.Organization;
			}
		}
		else
			return null;
	}
	
	SiteLinkSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (searchText)
					this.typeNames = ['Site', 'Offering'];
				else
					this.typeNames = ['Site'];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (searchText)
				this.typeNames = ['Offering', 'Site', 'Organization'];
			else
				this.typeNames = [""];
		}
		else if (searchText)
		{
			this.typeNames = ['Site', 'Organization'];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	SiteLinkSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.siteName() || "");
	}
	
	function SiteLinkSearchView(sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return SiteLinkSearchView;
})();

/* Typenames can be "Offering" or "Offering from Site" or "Service". The return types can be Offerings. */
var OfferingLinkSectionView = (function() {
	OfferingLinkSectionView.prototype = Object.create(crv.SectionView.prototype);
	OfferingLinkSectionView.prototype.constructor = OfferingLinkSectionView;
	
	OfferingLinkSectionView.prototype.appendDescription = function(div, d)
	{
		var leftText = d3.select(div);
		
		if (d instanceof cr.Offering)
		{
			var controller = this.sitePanel.controller();
			if (controller.site() && controller.site().id() == d.site().id())
				leftText.text(d.description());
			else
			{
				leftText.append('div')
					.classed('title', true).text(d.description());

				orgDiv = leftText.append('div').classed('organization', true);
				if (d.organization().id() !=
					(controller.organization() && controller.organization().id()))
					orgDiv.append('div').text(d.organization().description());
				if (d.site().description() != d.organization().description())
				{
					orgDiv.append('div')
						.classed('address-line', true)
						.text(d.site().description());
				}
			}
		}
		else if (d instanceof cr.Service)
		{
			leftText.text(d.description());
		}
		else
		{
			leftText.text(d.description());
		}
	}
	
	function OfferingLinkSectionView(sitePanel)
	{
		crv.SectionView.call(this, sitePanel);
		this.classed('cell picker offering', true);
	}
	
	return OfferingLinkSectionView;
})();

var OfferingLinkSearchView = (function() {
	OfferingLinkSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	OfferingLinkSearchView.prototype.constructor = OfferingLinkSearchView;

	OfferingLinkSearchView.prototype.clearFromOffering = function()
	{
		this.experienceController.clearOffering();
	}
	
	OfferingLinkSearchView.prototype.onClickButton = function(d, i) {
		var _this = this;
		if (d instanceof cr.Service)
		{
			if (prepareClick('click', 'service for offering: ' + d.description()))
			{
				this.experienceController.customOffering(d.description())
							   .offering(null);
				
				this.sitePanel.onExperienceUpdated();
				this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		else if (d instanceof cr.Offering)
		{
			if (prepareClick('click', 'offering: ' + d.description()))
			{
				this.experienceController.offeringPicked(d);
				this.sitePanel.onExperienceUpdated();
				_this.hideSearch(function()
					{
						_this.cancelSearch();
						unblockClick();
					});
			}
		}
		d3.event.preventDefault();
	}
	
	OfferingLinkSearchView.prototype.searchPath = function(val)
	{
		var path;

		if (this.experienceController.siteName())
		{
			if (this.experienceController.site())
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						return this.experienceController.site().urlPath() + "/offering";
					}
					else
						throw new Error('unrecognized typeName');
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = this.experienceController.site().urlPath() + '/offering[name>text*="{1}"]';
					}
					else
						throw new Error('unrecognized typeName');
			
					var symbol = "*=";
			
					return path.format(symbol, encodeURIComponent(val));
				}
			}
			else if (val)
			{
				throw new Error("Unreachable code");
			}
			else
				return '';
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						path = this.experienceController.organization().urlPath() + '/site/offering';
						path += this.experienceController.getOfferingConstraint();
						return path;
					}
					else
						return "Service";
				}
				else
				{
					if (this.typeName === "Offering")
					{
						path = '[name>text*="{1}"]|[site>name>text*="{1}"]';
						path = this.experienceController.organization().urlPath() + '/site/offering' + path;
						path += this.experienceController.getOfferingConstraint();
					}
			
					var symbol = "*=";
			
					return path.format(symbol, encodeURIComponent(val));
				}
			}
			else
			{
				console.assert(false) /* Unreachable code */;
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (val)
			{
				if (this.typeName === "Offering")
				{
					path = 'offering[name>text*="{1}"]|[site>name>text*="{1}"]|[site>organization>name>text*="{1}"]';
					path += this.experienceController.getOfferingConstraint();
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			

				var symbol = "*=";
			
				return path.format(symbol, encodeURIComponent(val));
			}
			else
			{
				path = "offering";
				path += this.experienceController.getOfferingConstraint();
				return path;
			}
		}
 		else if (val)
		{
			if (this.typeName === "Offering")
			{
				path = 'offering[name>text*="{1}"]' +
						this.experienceController.getOfferingConstraint();
			}
			else
				throw new Error("Unrecognized typeName: {0}".format(this.typeName));
				
			var symbol = "*=";
		
			return path.format(symbol, encodeURIComponent(val));
		}
		else
			return '';
	}
	
	OfferingLinkSearchView.prototype.resultType = function(val)
	{
		var path;

		if (this.experienceController.siteName())
		{
			if (this.experienceController.site())
			{
				if (this.typeName === "Offering")
					return cr.Offering;
				else
					throw new Error('unrecognized typeName');
			}
			else if (val)
			{
				throw new Error("Unreachable code");
			}
			else
				return '';
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (!val)
				{
					if (this.typeName === "Offering")
					{
						return cr.Offering;
					}
					else
						return cr.Service;
				}
				else
				{
					if (this.typeName === "Offering")
					{
						return cr.Offering;
					}
				}
			}
			else
			{
				throw new Error("Unreachable code");
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			if (val)
			{
				if (this.typeName === "Offering")
				{
					return cr.Offering;
				}
				else
					throw "Unrecognized typeName: {0}".format(this.typeName);
			}
			else
			{
				return cr.Offering;
			}
		}
 		else if (val)
		{
			if (this.typeName === "Offering")
				return cr.Offering;
			else
				throw new Error("Unrecognized typeName: {0}".format(this.typeName));
		}
		else
			return '';
	}
	
	OfferingLinkSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experienceController.siteName())
		{
			if (this.experienceController.site())
			{
				this.typeNames = ["Offering"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (searchText)
					this.typeNames = ["Offering"];
				else if (this.experienceController.getOfferingConstraint())
					this.typeNames = ["Offering"];
				else
					this.typeNames = ["Service"];
			}
			else
			{
				this.typeNames = [""];
			}
		}
		else if (this.experienceController.experienceServices().length > 0)
		{
			this.typeNames = ["Offering"];
		}
		else if (searchText)
		{
			this.typeNames = ["Offering"];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	OfferingLinkSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.offeringName() || "");
	}
	
	function OfferingLinkSearchView(sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, sectionView, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return OfferingLinkSearchView;
})();

/* This is the entry panel for the workflow. The experience contains no data on entry. 
	This panel can specify a search domain or, with typing, pick a service, offering, organization or site.
	One can also specify a custom service or a custom organization. */
var ConfirmDeleteAlert = (function () {
	ConfirmDeleteAlert.prototype = ConfirmPanel.prototype;
	ConfirmDeleteAlert.prototype.constructor = ConfirmDeleteAlert;

	function ConfirmDeleteAlert(panelNode, confirmText, done, cancel)
	{
		ConfirmPanel.call(this);
	
		var _this = this;
		var confirmButton = this.appendButton()
			.text(confirmText)
			.classed('text-danger', true)
			.classed('site-active-text', false);
			
		$(confirmButton.node()).on('click', function(e)
			{
				if (prepareClick('click', confirmText))
				{
					_this.hideDown()
						.then(done, cr.syncFail);
				}
				e.stopPropagation();
			});
				
		var cancelButton = this.appendButton()
			.text(crv.buttonTexts.cancel);
		
		$(cancelButton.node()).click(function(e) { _this.onCancel(e); });
	}
	
	return ConfirmDeleteAlert;
})();

var ExperienceShareOptions = (function () {
	ExperienceShareOptions.prototype = ConfirmPanel.prototype;
	ExperienceShareOptions.prototype.constructor = ExperienceShareOptions;

	function ExperienceShareOptions(experience, path)
	{
		ConfirmPanel.call(this);

		var _this = this;		
		if (cr.signedinUser)
		{
			var duplicateText = (path == cr.signedinUser.path()) ? "Duplicate Experience" : "Add to My Pathway";
		
			var addToMyPathwayButton = this.appendButton()
				.text(duplicateText);
			
			$(addToMyPathwayButton.node()).on('click', function(e)
				{
					if (prepareClick('click', duplicateText))
					{
						var experienceController = new ExperienceController(cr.signedinUser.path(), experience, false);
						var newPanel = new NewExperiencePanel(experienceController);
						newPanel.showUp()
							.done(function()
								{
									_this.panel.remove();
								})
							.always(unblockClick);
					}
					e.stopPropagation();
				});
		}
		
		var emailAddExperienceButton = this.appendButton()
			.text("Mail Add Experience Link");
			
		$(emailAddExperienceButton.node()).on('click', function(e)
			{
				if (prepareClick('click', "Mail Add Experience Link"))
				{
					_this.hideDown()
						.then(function()
						{
							window.location = 'mailto:?subject=Add%20Pathway%20Experience&body=Here is a link to add an experience to your pathway: {0}/add/{1}/.'
										.format(window.location.origin, experience.id());
							unblockClick();
						},
						cr.syncFail);
				}
				e.stopPropagation();
			});
			
		var copyButton = this.appendButton()
			.text("Copy Experience Link")
			.classed('copy', true)
			.attr('data-clipboard-text', 
			      '{0}/experience/{1}'.format(window.location.origin, experience.id()));
		
		var clipboard = new Clipboard(copyButton.node());
		$(this.panel.node()).on('remove', function() { clipboard.destroy(); });
			
		clipboard.on('error', function(e) {
			cr.asyncFail("Press Ctrl+C to copy");
		});
						
		var cancelButton = this.appendButton()
			.text(crv.buttonTexts.cancel);
		
		$(cancelButton.node()).click(function(e) { _this.onCancel(e); });
	}
	
	return ExperienceShareOptions;
})();

var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = Object.create(EditItemPanel.prototype);
	NewExperiencePanel.prototype.constructor = NewExperiencePanel;

	NewExperiencePanel.prototype.organizationSearchView = null;
	NewExperiencePanel.prototype.siteSearchView = null;
	NewExperiencePanel.prototype.offeringSearchView = null;
	NewExperiencePanel.prototype.tagsSection = null;
	NewExperiencePanel.prototype.tagSearchView = null;
	NewExperiencePanel.prototype.startHidable = null;
	NewExperiencePanel.prototype.endHidable = null;
	
	/* A function called when the panel is dismissed successfully. */
	NewExperiencePanel.prototype.done = null;

	NewExperiencePanel.prototype.title = "New Experience";
	NewExperiencePanel.prototype.editTitle = "Edit Experience";
	NewExperiencePanel.prototype.newFromDomainTitle = "New {0} Experience";
	NewExperiencePanel.prototype.timeframeLabel = "This experience is...";
	NewExperiencePanel.prototype.previousExperienceLabel = "Done";
	NewExperiencePanel.prototype.currentExperienceLabel = "Something I'm Doing Now";
	NewExperiencePanel.prototype.goalLabel = "My Goal";
	NewExperiencePanel.prototype.nameOrTagRequiredMessage = 'Your experience needs at least a tag or a title.';
	NewExperiencePanel.prototype.organizationDefaultPlaceholder = 'Organization (Optional)';
	NewExperiencePanel.prototype.siteDefaultPlaceholder = 'Location (Optional)';
	NewExperiencePanel.prototype.offeringDefaultPlaceholder = 'Title';
	
	NewExperiencePanel.prototype.hiddenDocumentation = "This experience will be hidden from anyone who can see your path unless you share this experience with them explicitly.";
	NewExperiencePanel.prototype.visibleDocumentation = "This experience will appear to anyone who can see your path.";

	NewExperiencePanel.prototype.tipLevelShift = 3;
	
	NewExperiencePanel.prototype.setTagColor = function(node)
	{
		this.tagPoolSection.setTagColor(node);
	}
	
	NewExperiencePanel.prototype.setTagInputWidth = function(inputNode)
	{
		this.tagPoolSection.setTagInputWidth(inputNode);
	}
	
	NewExperiencePanel.prototype.showTags = function()
	{
		var offeringTags = this.controller().primaryServices() || [];
		var _this = this;
		
		var container = this.mainDiv.select('span.offering-tags-container');
		container.selectAll('span').remove();
		var parent = $(container.node().parentNode.parentNode);
		if (offeringTags.length > 0)
		{
			container.selectAll('span')
				.data(offeringTags)
				.enter()
				.append('span')
				.classed('tag', true)
				.text(function(d) { return d.description(); })
				.each(function()
					{
						_this.setTagColor(this);
					});
			parent.css('display', 'block');
		}
		else
		{
			parent.css('display', 'none');
		}
	}
	
	NewExperiencePanel.prototype._serviceLabel = function(service, namesFunction)
	{
		if (!service)
			return "";
		
		var names = namesFunction(service);
		if (names && names.length)
			return names[0];	
			
		var subObj = service.serviceImplications().find(function(s)
			{
				var names = namesFunction(s.service());
				return names && names.length;
			});
		return subObj && namesFunction(subObj.service())[0];
	}
	
	NewExperiencePanel.prototype.setPlaceholders = function()
	{
		var experienceService = this.controller().experienceServices().find(function(s)
			{
				return s.service().getColumn() < PathGuides.data.length - 1;
			});
		
		var service = experienceService && experienceService.service();
		
		if (this.organizationInput)
		{	
			this.organizationInput
				.attr('placeholder', 
					  (service && this._serviceLabel(service, function(s) { return s.organizationLabels(); })) || this.organizationDefaultPlaceholder);
			this.siteInput
				.attr('placeholder', 
					  (service && this._serviceLabel(service, function(s) { return s.siteLabels(); })) || this.siteDefaultPlaceholder);
			this.offeringInput
				.attr('placeholder', 
					  (service && this._serviceLabel(service, function(s) { return s.offeringLabels(); })) || this.offeringDefaultPlaceholder);
		}
	}
	
	NewExperiencePanel.prototype.updateInputs = function()
	{
		if (this.organizationInput)
		{
			/* Reset the placeholders to ensure that they are properly displayed or hidden given
				the changes in the values. This fixes a bug on MacOS Safari.
			 */
			this.organizationInput.attr('placeholder', null);
			this.siteInput.attr('placeholder', null);
			this.offeringInput.attr('placeholder', null);
		
			this.organizationInput.node().value = this.controller().organizationName();
			this.siteInput.node().value = this.controller().siteName();
			this.offeringInput.node().value = this.controller().offeringName();
		}

		this.setPlaceholders();
	}

	NewExperiencePanel.prototype.onExperienceUpdated = function()
	{
		this.updateInputs();
		this.showTags();
		this.calculateHeight();
	}
	
	NewExperiencePanel.prototype.checkOrganizationInput = function()
	{
		var newText = this.organizationSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.organizationSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.id() != (this.controller().organization() && this.controller().organization().id()))
				{
					if (newInstance instanceof cr.Organization)
						this.controller().organizationPicked(newInstance);
					else if (newInstance instanceof cr.Site)
						this.controller().sitePicked(newInstance);
					else
						console.assert(false);
				}
			else if (newText != this.controller().organizationName())
			{
				if (this.controller().organization())
				{
					this.organizationSearchView.clearFromOrganization();
					this.controller().customOrganization(newText);
				}
				else
				{
					this.controller().customOrganization(newText)
											 .organization(null);
				}
			}
		}
		else
			this.organizationSearchView.clearFromOrganization();
	}
		
	NewExperiencePanel.prototype.checkSiteInput = function()
	{
		var newText = this.siteSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.siteSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.id() != (this.controller().site() && this.controller().site().id()))
			{
				if (newInstance instanceof cr.Site)
					this.controller().sitePicked(newInstance);
				else if (newInstance instanceof cr.Offering)
					this.controller().offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.controller().siteName())
				if (this.controller().site())
				{
					this.siteSearchView.clearFromSite();
					this.controller().customSite(newText);
				}
				else
				{
					this.controller().customSite(newText)
									 .site(null);
				}
		}
		else
			this.siteSearchView.clearFromSite();
	}
	
	NewExperiencePanel.prototype.checkOfferingInput = function()
	{
		var newText = this.offeringSearchView.inputText();
		if (newText)
		{
			/* If there is only an item that matches the input text, then use that item. */
			var newInstance = this.offeringSearchView.hasNamedButton(newText.toLocaleLowerCase());
			if (newInstance && 
				newInstance.id() != (this.controller().offering() && this.controller().offering().id()))
			{
				if (newInstance instanceof cr.Offering)
					this.controller().offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.controller().offeringName())
				this.controller().customOffering(newText)
										 .offering(null);
		}
		else
		{
			this.offeringSearchView.clearFromOffering();
		}
	}
	
	NewExperiencePanel.prototype.checkCommentInput = function()
	{
		if (!this.controller().oldInstance())
		{
			var text = this.commentInputNode.value;
			var comments = this.controller().newInstance().comments();
			if (text)
			{
				if (comments.length == 0)
				{
					var newComment = new cr.Comment();
					newComment.text(text);
					comments.push(newComment);
				}
				else
				{
					comments[0].text(text);
				}
			}
			else if (this.controller().newInstance().comments().length > 0)
			{
				comments[0].deleteData();
			}
		}
	}
	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	NewExperiencePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (this.organizationSearchView &&
			newReveal != this.organizationSearchView.reveal &&
			this.organizationSearchView.reveal.isVisible())
		{
			this.checkOrganizationInput();
			this.organizationSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (this.siteSearchView &&
			newReveal != this.siteSearchView.reveal &&
			this.siteSearchView.reveal.isVisible())
		{
			this.checkSiteInput();
			this.siteSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (this.offeringSearchView &&
			newReveal != this.offeringSearchView.reveal &&
			this.offeringSearchView.reveal.isVisible())
		{
			this.checkOfferingInput();
			this.offeringSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.tagPoolSection.reveal() &&
			this.tagPoolSection.reveal().isVisible())
		{
			this.tagPoolSection.hideReveal(done);
			return true;
		}
		else if (this.startHidable &&
			newReveal != this.startHidable.wheelReveal &&
			this.startHidable.wheelReveal.isVisible())
		{
			this.startHidable.hideWheel(done);
			return true;
		}
		else if (this.endHidable &&
			newReveal != this.endHidable.wheelReveal &&
			this.endHidable.wheelReveal.isVisible())
		{
			this.endHidable.hideWheel(done);
			return true;
		}
		else if (document.activeElement == this.commentInputNode)
		{
			this.checkCommentInput();
			return false;
		}
		else
			return false;
	}
	
	NewExperiencePanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		PathGuides.clearNode(inputNode);
			
		var done = function()
			{
				_this.tagPoolSection.revealSearchView(inputNode, true);
			};
		if (!this.onFocusInOtherInput(_this.tagPoolSection.reveal(), done))
		{
			this.tagPoolSection.revealSearchView(inputNode, false);
		}
	}
	
	NewExperiencePanel.prototype.resizeVisibleSearch = function(duration)
	{
		this.tagPoolSection.resizeVisibleSearch(duration) ||
		this.organizationSearchView &&
			(this.organizationSearchView.resizeVisibleSearch(duration) ||
			 this.siteSearchView.resizeVisibleSearch(duration) ||
			 this.offeringSearchView.resizeVisibleSearch(duration));
	}

	NewExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		/* Test case: Delete an experience. */
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmDeleteAlert(this.node(), "Delete Experience", 
				function() { 
					_this.controller().oldInstance().deleteData()
						.then(function() { _this.hideDown(unblockClick) },
							  cr.syncFail);
				}, 
				unblockClick);
		}
	}
	
	NewExperiencePanel.prototype.checkTimeframe = function()
	{
		if (this.controller().start() && this.controller().end())
		{
			this.controller().timeframe(null);
		}
		else
		{
			var timeframeName;
			
			if (this.previousExperienceButton.classed('pressed'))
				timeframeName = 'Previous';
			else if (this.currentExperienceButton.classed('pressed'))
				timeframeName = 'Current';
			else
				timeframeName = 'Goal';
			this.controller().timeframe(timeframeName);
		}
	}
	
	NewExperiencePanel.prototype.setDateRangeLabels = function()
	{
		this.startDateContainer.select('label')
					.text(this.goalButton.classed('pressed') ? crv.buttonTexts.starts : crv.buttonTexts.started);
		this.endDateContainer.select('label')
					.text(this.previousExperienceButton.classed('pressed') ? crv.buttonTexts.ended : crv.buttonTexts.ends);
	}
	
	NewExperiencePanel.prototype.focusLastTag = function()
	{
		var tagInputNode = this.tagPoolSection.tagsContainer.select('input.tag:last-of-type').node();
		tagInputNode.focus();
		tagInputNode.setSelectionRange(0, tagInputNode.value.length)
	}
	
	NewExperiencePanel.prototype.checkDateAlignment = function()
	{
		if (!('optionPanel' in this))
		{
			; /* Do nothing */
		}
		else if ($(this.optionPanel.node()).innerWidth() <
			$(this.optionPanel.node()).children().map(function(e) { return $(this).outerWidth(); })
				.toArray().reduce(function(a, b) { return a + b; }, 0))
		{
			$(this.startDateContainer.labelNode()).width('auto');
			$(this.endDateContainer.labelNode()).width('auto');
			
			this.startDateContainer.itemList().style('text-align', null);
			this.endDateContainer.itemList().style('text-align', null);
		}
		else
		{
			var width = $(this.optionPanel.select('label').node()).width();
			$(this.startDateContainer.labelNode()).width(width);
			$(this.endDateContainer.labelNode()).width(width);
			
			this.startDateContainer.itemList().style('text-align', 'left');
			this.endDateContainer.itemList().style('text-align', 'left');
		}
	}
		
	NewExperiencePanel.prototype.checkHiddenControlVisibility = function()
	{
		if (this.controller().newInstance().isHidden())
		{
			this.isHiddenDocumentationContainer.text(this.hiddenDocumentation);
		}
		else
		{
			this.isHiddenDocumentationContainer.text(this.visibleDocumentation);
		}
	}
	
	NewExperiencePanel.prototype.checkTips = function()
	{
		var tipLevel = ((cr.signedinUser.tipLevel() || 0) & TagsHilitePanel.prototype.tipLevelMask) >>> this.tipLevelShift;
		if (tipLevel == 0)
		{
			new TagsHilitePanel(this);
		} else if (tipLevel == 1)
		{
			new TimeframesHilitePanel(this);
		} else if (tipLevel == 2)
		{
			new OrganizationHilitePanel(this);
		} else if (tipLevel == 3)
		{
			new OfferingHilitePanel(this);
		} else if (tipLevel == 4)
		{
			new HiddenToggleHilitePanel(this);
		} else if (tipLevel == 5)
		{
			new AddButtonHilitePanel(this);
		}
	}
	
	function NewExperiencePanel(experienceController, showFunction) {
		EditItemPanel.call(this, experienceController);
			
		if (this.controller().title())
			this.title = this.controller().title();
		else if (this.controller().oldInstance())
			this.title = this.editTitle;
		else if (this.controller().domain())
			this.title = this.newFromDomainTitle.format(this.controller().domain().description());
		else if (this.controller().stage())
			this.title = this.newFromDomainTitle.format(this.controller().stage());
			
		showFunction = showFunction !== undefined ? showFunction : revealPanelUp;
			
		this.createRoot(this.title, showFunction);
		this.panelDiv.classed('experience new-experience-panel', true);
		this.mainDiv.classed('vertical-scrolling', false);
		
		var hidePanel = function() { 
				_this.hide()
					.then(function() {					
						if (_this.done)
							_this.done();
					});
			}
		var _this = this;
		
		if (experienceController.oldInstance())
		{
			var shareButton = this.navContainer.appendRightButton()
				.on('click', function()
					{
						if (prepareClick('click', 'share'))
						{
							new ExperienceShareOptions(experienceController.oldInstance(), experienceController.parent());
						}
					});
			shareButton.append('img')
				.attr('src', shareImagePath);
		}
		
		var panel2Div = this.mainDiv;
		
		var bottomNavContainer = this.appendBottomNavContainer();
		
		if (experienceController.oldInstance())
		{
			bottomNavContainer.appendLeftButton()
				.on("click", 
					function() {
						_this.handleDeleteButtonClick();
					})
				.append("span").classed('text-danger', true).text("Delete");
		}

		var section;
		var label;
		var searchContainer;
		
		/* The tags section. */
		this.tagPoolSection = new TagPoolSection(this.mainDiv, experienceController, '');
		this.tagPoolSection.addAddTagButton();
				
		var tagsChanged = function() { _this.setPlaceholders(); }
		$(this.tagPoolSection).on('tagsChanged.cr', this.node(), tagsChanged);
		$(this.node()).on('clearTriggers.cr remove', null, this.tagPoolSection, 
			function(eventObject)
				{
					$(_this.tagPoolSection).off('tagsChanged.cr', tagsChanged);
				});

		var tagsFocused = function()
			{
				try
				{
					_this.onFocusInTagInput(_this.tagPoolSection.searchView.focusNode);
				}
				catch (err)
				{
					cr.asyncFail(err);
				}
			}
		$(this.tagPoolSection).on('tagsFocused.cr', this.node(), tagsFocused);
		$(this.node()).on('clearTriggers.cr remove', null, this.tagPoolSection, 
			function(eventObject)
				{
					$(_this.tagPoolSection).off('tagsFocused.cr', tagsFocused);
				});
		
		this._fillTagsPromise = this.tagPoolSection.fillTags()
			.then(function()
				{
					var tagPoolSection = _this.tagPoolSection;
					tagPoolSection.showTags();
					
					var tagInput = tagPoolSection.tagsContainer.select('input.tag');
					if (tagInput.size() == 0)
					{
						tagInput = tagPoolSection.appendTag(null);
						tagPoolSection.hideAddTagButton(0);
					}
				}, cr.chainFail);

		if (experienceController.newInstance().engagement())
		{
			var experience = experienceController.newInstance();
			
			if (experience.start())
				this.appendUniqueValue(crv.buttonTexts.started, getLocaleDateString(experience.start()))
					.classed('first', true);

			if (experience.end())
				this.appendUniqueValue(crv.buttonTexts.ended, getLocaleDateString(experience.end()));

			if (experience.organization())
				this.appendUniqueValue('', experience.organization().description())
					.classed('first', true);
			if (experience.site())
				this.appendUniqueValue('', experience.site().description());
			if (experience.offering())
				this.appendUniqueValue('', experience.offering().description());
		}
		else
		{
			/* Code starting for the date range. */
			var birthday = experienceController.parent().birthday() ||
				(function()
				 {
					var todayDate = getUTCTodayDate();
					return "{0}-{1}".format(todayDate.getUTCFullYear() - 100, getMonthString(todayDate));
				 })();
		
			this.optionPanel = panel2Div.append('section')
				.classed('date-range-options', true);
		
			this.optionPanel.append('label')
				.text(this.timeframeLabel);
				
			function completeTimeframeButtonClick()
			{
				$(startDateWheel).trigger('change');
				_this.setDateRangeLabels();
				_this.checkTimeframe();
			}

			var buttonDiv = this.optionPanel.append('div');
			this.previousExperienceButton = buttonDiv.append('button')
				.classed('previous', true)
				.on('click', function()
					{
						_this.currentExperienceButton.classed('pressed', false);
						_this.goalButton.classed('pressed', false);
						_this.previousExperienceButton.classed('pressed', true);
					
						startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
						completeTimeframeButtonClick();
					})
				.text(this.previousExperienceLabel);
		
			this.currentExperienceButton = buttonDiv.append('button')
				.classed('present', true)
				.on('click', function()
					{
						_this.goalButton.classed('pressed', false);
						_this.previousExperienceButton.classed('pressed', false);
						_this.currentExperienceButton.classed('pressed', true);
					
						startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
						completeTimeframeButtonClick();
					})
				.text(this.currentExperienceLabel);
		
			this.goalButton = buttonDiv.append('button')
				.classed('goal', true)
				.on('click', function()
					{
						_this.previousExperienceButton.classed('pressed', false);
						_this.currentExperienceButton.classed('pressed', false);
						_this.goalButton.classed('pressed', true);
					
						setGoalStartDateRange();
						completeTimeframeButtonClick();
					})
				.text(this.goalLabel);
			
			var startValue;	
			if (experienceController.start())
				startValue = experienceController.start();
			else
			{
				if (experienceController.end())
				{
					/* Initialize the start date to a reasonable value, not the current date. */
					var startGuessDate = new Date(experienceController.end());
					startGuessDate.setUTCFullYear(startGuessDate.getUTCFullYear() - 1);
					var startGuessDateString = startGuessDate.toISOString().substring(0, 7);
					if (startGuessDateString < birthday)
						startValue = birthday;
					else
						startValue = startGuessDateString;
				}
			}
		
			var endValue;
			if (experienceController.end())
				endValue = experienceController.end();
			else
			{
				if (experienceController.start())
				{
					/* Initialize the end date to a reasonable value. */
					var guessDate = new Date(experienceController.start());
					guessDate.setUTCFullYear(guessDate.getUTCFullYear() + 1);
					endValue = guessDate.toISOString().substring(0, 7);
				}
				else
					endValue = null;
			}
		
			this.startDateContainer = this.appendDateSection(this.controller().newInstance(),
				this.controller().newInstance().start,
				"Start", new Date(birthday), getUTCTodayDate(), false, "Not Sure");
			this.startHidable = this.startDateContainer.editor;
			var startDateWheel = this.startHidable.dateWheel;
			
			$(startDateWheel).on('change', function() {
				var minEndDate, maxEndDate;
				var dateWheelValue = this.value() != '' ? this.value() : null;
				if (_this.previousExperienceButton.classed('pressed'))
				{
					if (dateWheelValue && dateWheelValue.length > 0)
						minEndDate = new Date(dateWheelValue);
					else if (birthday)
						minEndDate = new Date(birthday);
					else
						minEndDate = getUTCTodayDate();
				}
				else if (_this.currentExperienceButton.classed('pressed'))
				{
					minEndDate = getUTCTodayDate();
				}
				else
				{
					if (dateWheelValue && dateWheelValue.length > 0)
						minEndDate = new Date(dateWheelValue);
					else
						minEndDate = getUTCTodayDate();
				}
			
				if (_this.previousExperienceButton.classed('pressed'))
				{
					maxEndDate = getUTCTodayDate();
				}
				else
				{
					maxEndDate = getUTCTodayDate();
					maxEndDate.setUTCFullYear(maxEndDate.getUTCFullYear() + 50);
				}
				
				endDateWheel.checkMinDate(minEndDate, maxEndDate);
				$(endDateWheel).trigger('change');
			});
		
			this.endDateContainer = this.appendDateSection(this.controller().newInstance(),
				this.controller().newInstance().end,
				"End", new Date(birthday), getUTCTodayDate(), false, "Not Sure");
			
			this.endHidable = this.endDateContainer.editor;
			var endDateWheel = this.endHidable.dateWheel;
		
			$(endDateWheel).on('change', function() {
				_this.checkTimeframe();
			});
		
			/* The organization section. */
			section = new OrganizationLinkSectionView(this);
				
			this.organizationInput = section.append('input')
				.classed('organization', true)
				.attr('placeholder', this.organizationDefaultPlaceholder)
				.attr('value', experienceController.organizationName());
			organizationHelp = section.append('div')
				.classed('help', true);
			
			searchContainer = section.append('div');
			
			this.organizationSearchView = new OrganizationLinkSearchView(section, searchContainer.node(), 
																	 this, experienceController, 
																	 this.organizationInput.node(), 
																	 organizationHelp.node());
		
			section = new SiteLinkSectionView(this);
				
			this.siteInput = section.append('input')
				.classed('site', true)
				.attr('placeholder', this.siteDefaultPlaceholder)
				.attr('value', experienceController.siteName());
			siteHelp = section.append('div').classed('help', true);
		
			searchContainer = section.append('div');
			
			this.siteSearchView = new SiteLinkSearchView(section, searchContainer.node(), 
													 this, experienceController, 
													 this.siteInput.node(), 
													 siteHelp.node());
		
			section = new OfferingLinkSectionView(this);
				
			this.offeringInput = section.append('input')
				.classed('offering', true)
				.attr('placeholder', this.offeringDefaultPlaceholder)
				.attr('value', experienceController.offeringName());
			offeringHelp = section.append('div').classed('help', true);
			
			searchContainer = section.append('div');
			
			this.offeringSearchView = new OfferingLinkSearchView(section, searchContainer.node(), 
															 this, experienceController, 
															 this.offeringInput.node(), 
															 offeringHelp.node());
															 
			$(this.organizationInput.node()).on('focusin', function()
				{
					var done = function()
							{
								_this.organizationSearchView.restartSearchTimeout();
								_this.organizationSearchView.showSearch(200, undefined, function()
									{
										var oldTop = $(_this.organizationInput.node()).offset().top;
										if (oldTop < $(window).scrollTop())
										{
											var body = $("html, body");
											body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
										}
									});
							};
					if (!_this.onFocusInOtherInput(_this.organizationSearchView.reveal, done))
					{
						if (!_this.organizationSearchView.reveal.isVisible())
							done();
					}
				});
			
			$(this.siteInput.node()).on('focusin', function()
				{
					var done = function()
							{
								_this.siteSearchView.restartSearchTimeout();
								_this.siteSearchView.showSearch(200, undefined, function()
									{
										var oldTop = $(_this.siteInput.node()).offset().top;
										if (oldTop < $(window).scrollTop())
										{
											var body = $("html, body");
											body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
										}
									});
							}
					if (!_this.onFocusInOtherInput(_this.siteSearchView.reveal, done))
					{
						if (!_this.siteSearchView.reveal.isVisible())
							done();
					}
				});
		
			$(this.offeringInput.node()).on('focusin', function()
				{
					var done = function()
							{
								_this.offeringSearchView.restartSearchTimeout();
								_this.offeringSearchView.showSearch(200, undefined, function()
									{
										var oldTop = $(_this.offeringInput.node()).offset().top;
										if (oldTop < $(window).scrollTop())
										{
											var body = $("html, body");
											body.animate({scrollTop: "{0}px".format(oldTop)}, {duration: 200});
										}
									});
							};
					if (!_this.onFocusInOtherInput(_this.offeringSearchView.reveal, done))
					{
						if (!_this.offeringSearchView.reveal.isVisible())
							done();
					}
				});
		}
		
		/* The offering tags section. */
		tagsTopContainer = panel2Div.append('section')
			.classed('cell tags offering', true)
			.append('div');
		label = tagsTopContainer.append('label')
			.append('span')
			.text("Offering Tags:");
		
		tagsTopContainer.append('span')
			.classed('offering-tags-container', true);
			
		this.isHiddenSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true);
		
		this.isHiddenSection.append('label')
			.text(crv.buttonTexts.hiddenExperience);
			
		this.isHiddenControl = this.appendCheckboxEditor(this.isHiddenSection, experienceController.newInstance().isHidden(), "checkbox");
		
		var docSection = this.mainDiv.append('section')
			.classed('cell documentation', true);

		this.isHiddenDocumentationContainer = docSection.append('div')
			.text(experienceController.newInstance().isHidden() ? this.hiddenDocumentation : this.visibleDocumentation);

		$(this.isHiddenControl.node()).on('change', function()
			{
				var newChecked = _this.isHiddenControl.node().checked;
				if (prepareClick('click', 
								 newChecked ? 
								 	'is hidden hiding' : 
								 	'is hidden showing'))
				{
					experienceController.newInstance().isHidden(newChecked);
					_this.checkHiddenControlVisibility();
					unblockClick();
				}
				else
					_this.isHiddenControl.node().checked = !newChecked;
			});
					
		/* The initial comment section. */
		if (!experienceController.oldInstance())
		{
			commentContainer = panel2Div.append('section')
				.classed('cell comment', true);
				
			this.commentInputNode = commentContainer.append('textarea')
				.attr('placeholder', "Comment")
				.node();
			
			$(this.commentInputNode).on('input', function(eventObject)
				{
					this.style.height = 0;
					this.style.height = (this.scrollHeight) + 'px';
					this.parentNode.style.height = this.style.height;
					if (eventObject)
						eventObject.stopPropagation();
				})
				.on('focusout', function(eventObject)
				{
					_this.checkCommentInput();
				});
			$(this.commentInputNode).trigger('input');
		}
		
		function setGoalStartDateRange()
		{
			var startMinDate = getUTCTodayDate();
			var startMaxDate = new Date(startMinDate);
			startMaxDate.setUTCFullYear(startMaxDate.getUTCFullYear() + 50);
			startDateWheel.checkMinDate(startMinDate, startMaxDate);
		}
		
		$(this.node()).one('revealing.cr', function()
			{
				_this.updateInputs();
				_this.showTags();
				
				if (!experienceController.newInstance().engagement())
				{
					if (experienceController.timeframe() == 'Current')
					{
						startDateWheel.onChange();
						_this.currentExperienceButton.classed('pressed', true);
						startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					}
					else if (experienceController.timeframe() == 'Goal')
					{
						_this.goalButton.classed('pressed', true);
						setGoalStartDateRange();
					}
					else
					{
						startDateWheel.onChange();
						endDateWheel.onChange();
						_this.previousExperienceButton.classed('pressed', true);
						startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					}
					$(startDateWheel).trigger('change');
					_this.setDateRangeLabels();
				}

				/* Once everything is set up, subsequent resizing should update the visible
					search VerticalReveal. Until that point, metrics aren't correct.
				 */
				$(panel2Div.node()).on('resize.cr', function()
				{
					_this.resizeVisibleSearch(0);
					_this.checkDateAlignment();
				});
				_this.checkDateAlignment();
			});
	}
	
	return NewExperiencePanel;
})();

var ExperienceSecurityPanel = (function () {
	ExperienceSecurityPanel.prototype = Object.create(GrantsPanel.prototype);
	ExperienceSecurityPanel.prototype.constructor = ExperienceSecurityPanel;
	ExperienceSecurityPanel.prototype.title = "Experience Sharing";
	
	ExperienceSecurityPanel.prototype.helpText = "Add a user to share this experience with them.";
	ExperienceSecurityPanel.prototype.newUserEmailDocumentation = 
		"Type the email address of someone you want to share this experience with.";
	ExperienceSecurityPanel.prototype.hiddenDocumentation = "This experience will be hidden from anyone who can see your path with unless you add them below.";
	ExperienceSecurityPanel.prototype.visibleDocumentation = "This experience will appear to anyone who can see your path.";
	

	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	ExperienceSecurityPanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		this.newInstance().isHidden(this.isHiddenControl.node().checked);
		return false;
	}
	
	ExperienceSecurityPanel.prototype.promiseUpdateChanges = function()
	{
		/* Do not save the changes now. Instead, they are saved when the parent panel is closed. */
		var r = $.Deferred();
		r.resolve();
		return r;
	}

	ExperienceSecurityPanel.prototype.addAccessRecord = function(sectionView, accessorLevel, path)
	{
		var _this = this;
		
		return cr.getData({path: path, resultType: cr.User, fields: ['none']})
			.then(function(grantees)
				{
					var userGrant = new (_this.grantor.userGrantType())();
					userGrant.privilege(accessorLevel.name);
					userGrant.grantee(grantees[0]);
					userGrant.parent(_this.grantor);
					_this.grantor.userGrants().push(userGrant);
					_this.onGrantAdded(sectionView, accessorLevel.itemsDiv, userGrant);
					var r2 = $.Deferred();
					r2.resolve(userGrant);
					return r2;
				},
				cr.chainFail);
	}
	
	ExperienceSecurityPanel.prototype.loadAccessRecords = function(panel2Div, grantor)
	{
		var _this = this;
		var itemCells, items;
		var accessRequestSection, accessRequestList;
		
		// Sort the access records by type.
		var grants = grantor.userGrants().concat(grantor.groupGrants());
		for (var i = 0; i < grants.length; ++i)
		{
			var a = grants[i];
			var privilege = a.privilege();
			if (privilege in this.privilegesByID)
			{
				var sa = this.privilegesByID[privilege];
				sa.accessRecords.push(a);
				sa.accessors.push(a);
			}
		}
	
		var sectionView = new crv.SectionView(this)
			.datum(this.privileges[0])
			.classed('cell multiple edit', true);
		
		/* Place this docSection inside the other section so that it gets hidden by the
			associated VerticalReveal.
		 */	
		var docSection = sectionView.append('section')
			.classed('cell documentation first', true);

		var docDiv = docSection.append('div');
		docDiv.text(this.helpText);
		
		itemCells = sectionView.appendItemList()
			.classed('deletable-items', true);
	
		// Reference the views back to the privileges objects.
		itemCells.each(function(d) { d.itemsDiv = this; });
		
		items = appendItems(itemCells, 
							function(d) { return d.accessors },
							function(d) {
								_this.editButton.style('display', itemCells.selectAll('li').size() ? '' : 'none');
								_this.navContainer.centerTitle();
							});
		
		this.appendUserControls(sectionView, items);
		
		this.editButton.style('display', itemCells.selectAll('li').size() ? '' : 'none');
		this.navContainer.centerTitle();
		this.reveal = new VerticalReveal(sectionView.node());
		if (!panel2Div.datum().isHidden())
			this.reveal.hide({duration: 0});
			
		/* Add one more button for the add Button item. */
		sectionView
			.append('button').classed('btn row-button add-item site-active-text', true)
			.on('click', function(d) {
				_this.addAccessor(sectionView, "Sharing User", d);
			})
			.append('div').text("Add User");
		
		this.checkHiddenControlVisibility(0);
	}

	ExperienceSecurityPanel.prototype.getPrivileges = function(panel2Div)
	{
		for (var j = 0; j < this.privileges.length; ++j)
		{
			var p = this.privileges[j];
			this.privilegesByID[p.name] = p;
		}
		this.loadAccessRecords(panel2Div, this.grantor);
	}
	
	ExperienceSecurityPanel.prototype.userGrantsPath = function()
	{
		return 'experience user grant';
	}
	
	ExperienceSecurityPanel.prototype.checkHiddenControlVisibility = function(duration, done)
	{
		if (this.grantor.isHidden())
		{
			this.isHiddenDocumentationContainer.text(this.hiddenDocumentation);
			this.reveal.show({duration: duration, done: done});
		}
		else
		{
			this.isHiddenDocumentationContainer.text(this.visibleDocumentation);
			this.reveal.hide({duration: duration, done: done});
		}
	}
	
	function ExperienceSecurityPanel(experienceController, backButtonText, showFunction) {
		GrantsPanel.call(this, experienceController.newInstance());
		
		var _this = this;
		this.createRoot(experienceController.newInstance(), this.title, showFunction);
		
		this.navContainer.appendTitle("Experience Sharing");
		var doneButton = this.navContainer.appendRightButton()
			.on('click', function()
				{
					if (prepareClick('click', 'done editing'))
					{
						showClickFeedback(this);
						_this.hide();
					}
				})
 			.text(crv.buttonTexts.done);

		this.appendEditButton();
		
		var isHiddenSection = this.mainDiv.append('section')
			.classed('cell edit unique first', true);
		
		isHiddenSection.append('label')
			.text(crv.buttonTexts.hiddenExperience);
			
		this.isHiddenControl = this.appendCheckboxEditor(isHiddenSection, experienceController.newInstance().isHidden());
		
		var docSection = this.mainDiv.append('section')
			.classed('cell documentation', true);

		this.isHiddenDocumentationContainer = docSection.append('div')
			.text(experienceController.newInstance().isHidden() ? this.hiddenDocumentation : this.visibleDocumentation);

		function saveValue()
		{
			var newChecked = _this.isHiddenControl.node().checked;
			if (prepareClick('click', 
							 newChecked ? 
								'is hidden hiding' : 
								'is hidden showing'))
			{
				experienceController.newInstance().isHidden(newChecked);
				_this.checkHiddenControlVisibility(400, unblockClick);
				experienceController.save(false)
					.then(function()
						{
						},
						function(err)
						{
							newChecked = !newChecked;
							experienceController.newInstance().isHidden(newChecked);
							_this.isHiddenControl.node().checked = newChecked;
							
							$(_this.isHiddenControl.node()).off('change', saveValue);
							
							_this.changedCheckboxEditor(_this.isHiddenControl.node());
				
							$(_this.isHiddenControl.node()).on('change', saveValue);
							_this.checkHiddenControlVisibility(400);
							cr.asyncFail(err);
						});
			}
			else
			{
				_this.isHiddenControl.node().checked = !newChecked;
				$(_this.isHiddenControl.node()).off('change', saveValue);
				
				_this.changedCheckboxEditor(_this.isHiddenControl.node());
				
				$(_this.isHiddenControl.node()).on('change', saveValue);
			}
		}
		$(this.isHiddenControl.node()).on('change', saveValue);
		
		this.privileges =  [
			{name: cr.privileges.read, id: "", accessRecords: [], accessors: []}];
	
		this.getPrivileges(this.mainDiv);
	}
	
	return ExperienceSecurityPanel;
})();

