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
	
	function MultiTypeOptionView(containerNode, experienceController)
	{
		this.containerNode = containerNode;
		if (containerNode)
		{
			console.assert(experienceController);
			console.assert(experienceController instanceof ExperienceController);

			this.experienceController = experienceController;
		}
		SearchOptionsView.call(this, containerNode, GetDataChunker)
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
		this.checkHelp(!this.typeName);
		this.showSearch();
		if (this.typeName)
			SearchOptionsView.prototype.startSearchTimeout.call(this, searchText);
	}
				
	ExperienceDatumSearchView.prototype.restartSearchTimeout = function(val)
	{
		val = val !== undefined ? val : this.inputCompareText();
		this.setupSearchTypes(val);
		this.checkHelp(!this.typeName);
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

	function ExperienceDatumSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		console.assert(containerNode);
		
		this.typeNames = [""];
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.initialTypeName;
		this.sitePanel = sitePanel;
		MultiTypeOptionView.call(this, containerNode, experienceController);
		
		var _this = this;

		this.inputBox = inputNode;
		$(this.inputBox).on("input", function() { 
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
				else if (!_this.getDataChunker.hasButtons() && !_this.inputText())
				{
					if ("checkHelp" in _this)
					{
						_this.checkHelp(true);
						_this.showSearch();
					}
				}
			};
	}
	
	return ExperienceDatumSearchView;
})();

/* Displays site or organization */
var OrganizationSearchView = (function() {
	OrganizationSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	OrganizationSearchView.prototype.constructor = OrganizationSearchView;

	OrganizationSearchView.prototype.clearFromOrganization = function()
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
	
	OrganizationSearchView.prototype.searchPath = function(val)
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
	
	OrganizationSearchView.prototype.resultType = function(val)
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
	
	OrganizationSearchView.prototype.setupSearchTypes = function(searchText)
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
	
	OrganizationSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'The name of the organization that is providing this experience.'},
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	OrganizationSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
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
						leftText.text(d.description());
					}
					else
					{
						orgDiv = leftText.append('div').classed("organization", true);		
						orgDiv.append('div').text(orgValue.description());
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.description());
					}
				}
				else
				{
					leftText.text(d.description());
				}
			});
	}
	
	OrganizationSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.organizationName() || "");
	}
	
	function OrganizationSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return OrganizationSearchView;
})();

/* Displays organization, site, offering */
var SiteSearchView = (function() {
	SiteSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	SiteSearchView.prototype.constructor = SiteSearchView;

	SiteSearchView.prototype.clearFromSite = function()
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
	
	SiteSearchView.prototype.searchPath = function(val)
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
	
	SiteSearchView.prototype.resultType = function(val)
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
			else if (this.typeName === "Organization")
			{
				return cr.Organization;
			}
		}
		else
			return null;
	}
	
	SiteSearchView.prototype.setupSearchTypes = function(searchText)
	{
		/* For each state, set up typeName, and the list of typeNames. */
		if (this.experienceController.organizationName())
		{
			if (this.experienceController.organization())
			{
				if (searchText)
					this.typeNames = ['Site', "Offering"];
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
				this.typeNames = ["Offering", 'Site', "Organization"];
			else
				this.typeNames = [""];
		}
		else if (searchText)
		{
			this.typeNames = ['Site', "Organization"];
		}
		else
		{
			this.typeNames = [""];
		}
		this.initialTypeName = this.typeNames[0];
		this.typeName = this.typeNames[0];
	}
	
	SiteSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'Examples:'}, 
						 {styles: 'list', text: 'Blackstone Community Center\n'},
						 {styles: 'list', text: 'Esplanade Boat House'},
						 {styles: 'list', text: 'Jackson/Mann School'},
						 {styles: 'list', text: 'McLean Playground'},
						 {styles: 'list', text: '24 Beacon St., Boston, MA'},
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	SiteSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
				if (d instanceof cr.Offering)
				{
					leftText.append('div')
						.classed('title', true).text(d.description());

					var orgDiv = leftText.append('div')
						.classed("organization", true);
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
						orgValue.id() == (_this.experienceController.organization() && _this.experienceController.organization().id()))
					{
						leftText.text(d.description());
					}
					else
					{
						orgDiv = leftText.append('div').classed("organization", true);		
						orgDiv.append('div').text(orgValue.description());
						orgDiv.append('div')
							.classed('address-line', true)
							.text(d.description());
					}
				}
				else
				{
					leftText.text(d.description());
				}
			});
	}
	
	SiteSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.siteName() || "");
	}
	
	function SiteSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return SiteSearchView;
})();

/* Typenames can be "Offering" or "Offering from Site" or "Service". The return types can be Offerings. */
var OfferingSearchView = (function() {
	OfferingSearchView.prototype = Object.create(ExperienceDatumSearchView.prototype);
	OfferingSearchView.prototype.constructor = OfferingSearchView;

	OfferingSearchView.prototype.clearFromOffering = function()
	{
		this.experienceController.clearOffering();
	}
	
	OfferingSearchView.prototype.onClickButton = function(d, i) {
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
	
	OfferingSearchView.prototype.searchPath = function(val)
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
	
	OfferingSearchView.prototype.resultType = function(val)
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
	
	OfferingSearchView.prototype.setupSearchTypes = function(searchText)
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
	
	OfferingSearchView.prototype.checkHelp = function(showHelp)
	{
		var helpDiv = d3.select(this.helpNode);

		if (showHelp == (helpDiv.style('display') == 'block'))
			return false;
			
		if (showHelp)
		{
			var texts = [{styles: '', text: 'The name of the program or service provided.'}, 
						 ];
			helpDiv.selectAll('p')
				.data(texts)
				.enter()
				.append('p')
				.classed('list', function(d) { return d.styles == 'list'; })
				.text(function(d) { return d.text; });
			helpDiv.style('display', 'block');
		}
		else
		{
			helpDiv.selectAll('p').remove();
			helpDiv.style('display', 'none');
		}
		return true;
	}
	
	OfferingSearchView.prototype.fillItems = function(buttons)
	{
		var _this = this;
		
		buttons.each(function(d)
			{
				var leftText = d3.select(this).append('div').classed("left-expanding-div description-text growable", true);
				if (d instanceof cr.Offering)
				{
					if (_this.experienceController.site() && _this.experienceController.site().id() == d.site().id())
						leftText.text(d.description());
					else
					{
						leftText.append('div')
							.classed('title', true).text(d.description());
	
						orgDiv = leftText.append('div').classed("organization", true);
						if (d.organization().id() !=
							(_this.experienceController.organization() && _this.experienceController.organization().id()))
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
			});
	}
	
	OfferingSearchView.prototype.isDirtyText = function()
	{
		/* inputText returns an empty string. Make sure test is not 'null' */
		return this.inputText() != (this.experienceController.offeringName() || "");
	}
	
	function OfferingSearchView(containerNode, sitePanel, experienceController, inputNode, helpNode)
	{
		ExperienceDatumSearchView.call(this, containerNode, sitePanel, experienceController, inputNode, helpNode);
	}
	
	return OfferingSearchView;
})();

/* This is the entry panel for the workflow. The experience contains no data on entry. 
	This panel can specify a search domain or, with typing, pick a service, offering, organization or site.
	One can also specify a custom service or a custom organization. */
var ConfirmDeleteAlert = (function () {

	function ConfirmDeleteAlert(panelNode, confirmText, done, cancel)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		var confirmButton = div.append('button')
			.text(confirmText)
			.classed("text-danger", true)
			.on("click", function()
				{
					if (prepareClick('click', confirmText))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							done();
						});
						dimmer.hide();
					}
				});
				
		var onCancel = function()
			{
				if (prepareClick('click', 'Cancel'))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
					dimmer.hide();
				}
			}
			
		div.append('button')
			.text(crv.buttonTexts.cancel)
			.on("click", onCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(confirmButton.node()).focus();
				unblockClick();
			}});
		$(confirmButton.node()).on('blur', function()
			{
				if (prepareClick('blur', confirmText))
				{
					$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
						panel.remove();
						cancel();
					});
				}
			});
			
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ConfirmDeleteAlert;
})();

var ExperienceShareOptions = (function () {

	function ExperienceShareOptions(panelNode, experience, path)
	{
		var dimmer = new Dimmer(panelNode);
		var panel = d3.select(panelNode).append('panel')
			.classed("confirm", true);
		var div = panel.append('div');
		function onCancel(e)
		{
			if (prepareClick('click', 'Cancel'))
			{
				$(emailAddExperienceButton.node()).off('blur');
				$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
					panel.remove();
					unblockClick();
				});
				dimmer.hide();
			}
			e.preventDefault();
		}
		
		if (cr.signedinUser)
		{
			var duplicateText = (path == cr.signedinUser.path()) ? "Duplicate Experience" : "Add to My Pathway";
		
			var addToMyPathwayButton = div.append('button')
				.text(duplicateText)
				.classed("site-active-text", true)
				.on("click", function()
					{
						if (prepareClick('click', duplicateText))
						{
							var experienceController = new ExperienceController(experience.path(), experience, false);
							var newPanel = new NewExperiencePanel(experienceController);
							newPanel.showUp()
								.done(function()
									{
										$(emailAddExperienceButton.node()).off('blur');
										panel.remove();
										dimmer.remove();
									})
								.always(unblockClick);
						}
					});
				
			$(addToMyPathwayButton.node()).on('blur', onCancel);
		}
		
		var emailAddExperienceButton = div.append('button')
			.text("Mail Add Experience Link")
			.classed("site-active-text", true)
			.on("click", function()
				{
					if (prepareClick('click', "Mail Add Experience Link"))
					{
						$(panel.node()).hide("slide", {direction: "down"}, 400, function() {
							panel.remove();
							window.location = 'mailto:?subject=Add%20Pathway%20Experience&body=Here is a link to add an experience to your pathway: {0}/add/{1}/.'
										.format(window.location.origin, experience.id());
							unblockClick();
						});
						dimmer.hide();
					}
				});
				
		$(emailAddExperienceButton.node()).on('blur', onCancel);
		
		var cancelButton = div.append('button')
			.text(crv.buttonTexts.cancel)
			.classed("site-active-text", true);
		
		$(cancelButton.node()).click(onCancel);
		
		dimmer.show();
		$(panel.node()).toggle("slide", {direction: "down", duration: 0});
		$(panel.node()).effect("slide", {direction: "down", duration: 400, complete: 
			function() {
				$(emailAddExperienceButton.node()).focus();
				unblockClick();
			}});
		dimmer.mousedown(onCancel);
		$(panel.node()).mousedown(function(e)
			{
				e.preventDefault();
			});
	}
	
	return ExperienceShareOptions;
})();

var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = Object.create(crv.SitePanel.prototype);
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
	NewExperiencePanel.prototype.firstTagHelp = 'What type of experience is this?';
	NewExperiencePanel.prototype.otherTagHelp = 'What other tag goes with this experience?';
	NewExperiencePanel.prototype.organizationDefaultPlaceholder = 'Organization (Optional)';
	NewExperiencePanel.prototype.siteDefaultPlaceholder = 'Location (Optional)';
	NewExperiencePanel.prototype.offeringDefaultPlaceholder = 'Title';
	
	NewExperiencePanel.prototype.appendHidableDateInput = function(dateContainer, minDate, maxDate)
	{
		var _this = this;
		var itemsDiv = crf.appendItemList(dateContainer)
			.classed('overlined', true);
		var itemDiv = itemsDiv.append('li');
		var dateSpan = itemDiv.append('span')
			.classed('growable', true);
		var dateWheel = new DateWheel(dateContainer.node().parentNode, function(newDate)
			{
				if (newDate)
					dateSpan.text(getLocaleDateString(newDate));
				else
					dateSpan.text("Not Sure");
			}, minDate, maxDate);

		var reveal = new VerticalReveal(dateWheel.node());
		reveal.hide();
		
		dateSpan.on('click', function()
			{
				if (!reveal.isVisible())
				{
					try
					{
						var done = function()
						{
							dateSpan.classed('site-active-text', true);
							reveal.show({}, 200, undefined, function()
								{
									dateWheel.onShowing();
								});
							notSureReveal.show({duration: 200});
						}
						if (!_this.onFocusInOtherInput(reveal, done))
						{
							done();
						}
					}
					catch (err)
					{
						cr.asyncFail(err);
					}
				}
				else
				{
					hideWheel();
				}
			});
		
		var notSureButton = d3.select(dateContainer.node().parentNode).append('div')
				.classed('not-sure-button site-active-text', true)
				.on('click', function()
					{
						if (prepareClick('click', "Not Sure"))
						{
							hideWheel();
							dateWheel.clear();
							dateSpan.text("Not Sure");
							unblockClick();
						}
					});
		notSureButton.append('div').text("Not Sure");
		var notSureReveal = new VerticalReveal(notSureButton.node());
		notSureReveal.hide();
			
		var hideWheel = function(done)
		{
			dateSpan.classed('site-active-text', false);
			dateWheel.onHiding();
			reveal.hide({duration: 200,
						 before: function()
						 	{
						 		notSureReveal.hide({duration: 200,  before: done});
						 	}});
		}
		
		var showWheel = function(done)
		{
			dateSpan.classed('site-active-text', true);
			reveal.show({}, 200, undefined,
				function()
				{
					notSureReveal.show({done: done});
				});
			
		}
		
		return {dateWheel: dateWheel, 
		    wheelReveal: reveal,
			notSureReveal: notSureReveal,
			hideWheel: hideWheel,
			showWheel: showWheel,
		};
	}
	
	NewExperiencePanel.prototype.setTagColor = function(node)
	{
		this.tagPoolSection.setTagColor(node);
	}
	
	NewExperiencePanel.prototype.setTagInputWidth = function(inputNode)
	{
		this.tagPoolSection.setTagInputWidth(inputNode);
	}
	
	NewExperiencePanel.prototype.appendTag = function(container, instance)
	{
		return this.tagPoolSection.appendTag(container, instance);
	}
	
	NewExperiencePanel.prototype.showTags = function()
	{
		var offeringTags = this.experienceController.primaryServices() || [];
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
		var experienceService = this.experienceController.experienceServices().find(function(s)
			{
				return s.service().getColumn() < PathGuides.data.length - 1;
			});
		
		var service = experienceService && experienceService.service();
			
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
	
	NewExperiencePanel.prototype.updateInputs = function()
	{
		/* Reset the placeholders to ensure that they are properly displayed or hidden given
			the changes in the values. This fixes a bug on MacOS Safari.
		 */
		this.organizationInput.attr('placeholder', null);
		this.siteInput.attr('placeholder', null);
		this.offeringInput.attr('placeholder', null);
		
		this.organizationInput.node().value = this.experienceController.organizationName();
		this.siteInput.node().value = this.experienceController.siteName();
		this.offeringInput.node().value = this.experienceController.offeringName();

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
				newInstance.id() != (this.experienceController.organization() && this.experienceController.organization().id()))
				{
					if (newInstance instanceof cr.Organization)
						this.experienceController.organizationPicked(newInstance);
					else if (newInstance instanceof cr.Site)
						this.experienceController.sitePicked(newInstance);
					else
						console.assert(false);
				}
			else if (newText != this.experienceController.organizationName())
			{
				if (this.experienceController.organization())
				{
					this.organizationSearchView.clearFromOrganization();
					this.experienceController.customOrganization(newText);
				}
				else
				{
					this.experienceController.customOrganization(newText)
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
				newInstance.id() != (this.experienceController.site() && this.experienceController.site().id()))
			{
				if (newInstance instanceof cr.Site)
					this.experienceController.sitePicked(newInstance);
				else if (newInstance instanceof cr.Offering)
					this.experienceController.offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.experienceController.siteName())
				if (this.experienceController.site())
				{
					this.siteSearchView.clearFromSite();
					this.experienceController.customSite(newText);
				}
				else
				{
					this.experienceController.customSite(newText)
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
				newInstance.id() != (this.experienceController.offering() && this.experienceController.offering().id()))
			{
				if (newInstance instanceof cr.Offering)
					this.experienceController.offeringPicked(newInstance);
				else
					console.assert(false);
			}
			else if (newText != this.experienceController.offeringName())
				this.experienceController.customOffering(newText)
										 .offering(null);
		}
		else
		{
			this.offeringSearchView.clearFromOffering();
		}
	}
	
	NewExperiencePanel.prototype.checkTagInput = function(exceptNode)
	{
		this.tagPoolSection.checkTagInput(exceptNode);
	}
	
	/* Hide the currently open input (if it isn't newReveal, and then execute done). */
	NewExperiencePanel.prototype.onFocusInOtherInput = function(newReveal, done)
	{
		if (newReveal != this.organizationSearchView.reveal &&
			this.organizationSearchView.reveal.isVisible())
		{
			this.checkOrganizationInput();
			this.organizationSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.siteSearchView.reveal &&
			this.siteSearchView.reveal.isVisible())
		{
			this.checkSiteInput();
			this.siteSearchView.hideSearch(done);
			this.updateInputs();
			this.showTags();
			return true;
		}
		else if (newReveal != this.offeringSearchView.reveal &&
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
		else if (newReveal != this.startHidable.wheelReveal &&
			this.startHidable.wheelReveal.isVisible())
		{
			this.startHidable.hideWheel(done);
			return true;
		}
		else if (newReveal != this.endHidable.wheelReveal &&
			this.endHidable.wheelReveal.isVisible())
		{
			this.endHidable.hideWheel(done);
			return true;
		}
		else
			return false;
	}
	
	NewExperiencePanel.prototype.setTagHelp = function()
	{
		this.tagPoolSection.setTagHelp();
	}
	
	NewExperiencePanel.prototype.hideAddTagButton = function()
	{
		this.tagPoolSection.hideAddTagButton();
	}
	
	NewExperiencePanel.prototype.showAddTagButton = function()
	{
		this.tagPoolSection.showAddTagButton();
	}
	
	NewExperiencePanel.prototype.onFocusInTagInput = function(inputNode)
	{
		var _this = this;
		d3.select(inputNode)
			.style('background-color', null)
			.style('border-color', null)
			.style('color', null);
			
		var done = function()
			{
				_this.tagPoolSection.revealSearchView(inputNode, true);
			};
		if (!this.onFocusInOtherInput(_this.tagPoolSection.reveal(), done))
		{
			this.tagPoolSection.checkTagInput(inputNode);
			this.tagPoolSection.revealSearchView(inputNode, false);
		}
	}
	
	NewExperiencePanel.prototype.resizeVisibleSearch = function(duration)
	{
		this.tagPoolSection.resizeVisibleSearch(duration) ||
		this.organizationSearchView.resizeVisibleSearch(duration) ||
		this.siteSearchView.resizeVisibleSearch(duration) ||
		this.offeringSearchView.resizeVisibleSearch(duration);
	}

	NewExperiencePanel.prototype.handleDeleteButtonClick = function()
	{
		/* Test case: Delete an experience. */
		if (prepareClick('click', 'delete experience'))
		{
			var _this = this;
			new ConfirmDeleteAlert(this.node(), "Delete Experience", 
				function() { 
					_this.experienceController.oldInstance().deleteData()
						.then(function() { _this.hideDown(unblockClick) },
							  cr.syncFail);
				}, 
				unblockClick);
		}
	}
	
	function NewExperiencePanel(experienceController, showFunction) {
		this.experienceController = experienceController;
			
		if (this.experienceController.title())
			this.title = this.experienceController.title();
		else if (this.experienceController.oldInstance())
			this.title = this.editTitle;
		else if (this.experienceController.domain())
			this.title = this.newFromDomainTitle.format(this.experienceController.domain().description());
		else if (this.experienceController.stage())
			this.title = this.newFromDomainTitle.format(this.experienceController.stage());
			
		showFunction = showFunction !== undefined ? showFunction : revealPanelUp;
			
		this.createRoot(null, this.title, "edit experience new-experience-panel", showFunction);
		
		var hidePanel = function() { 
				_this.hide()
					.then(function() {					
						if (_this.done)
							_this.done();
					});
			}
		var _this = this;
		
		var navContainer = this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'NewExperiencePanel: Cancel'))
				{
					_this.hide();
				}
				d3.event.preventDefault();
			});
		backButton.append('span').text(crv.buttonTexts.cancel);
		
		if (experienceController.oldInstance())
		{
			var shareButton = navContainer.appendRightButton()
				.classed("share", true)
				.on('click', function()
					{
						if (prepareClick('click', 'share'))
						{
							new ExperienceShareOptions(_this.node(), experienceController.oldInstance(), experienceController.parent());
						}
					});
			shareButton.append("img")
				.attr("src", shareImagePath);
		}
		
		navContainer.appendTitle(this.title);
		
		var panel2Div = this.appendScrollArea();
		
		var bottomNavContainer = this.appendBottomNavContainer();
		var doneButton = bottomNavContainer.appendRightButton()
			.classed("site-active-text", true)
			.classed("default-link", true)
			.on("click", function()
			{
				function doAdd()
				{
					if (prepareClick('click', 'NewExperiencePanel: {0}'.format(doneButton.select("span").text())))
					{
						try
						{
							experienceController.start(startDateWheel.value() != '' ? startDateWheel.value() : null);
							experienceController.end(endDateWheel.value() != '' ? endDateWheel.value() : null);
							if (experienceController.start() && experienceController.end())
							{
								experienceController.timeframe(null);
								experienceController.save()
									.then(hidePanel, cr.syncFail);
							}
							else
							{
								var timeframeName;
								
								if (previousExperienceButton.classed('pressed'))
									timeframeName = 'Previous';
								else if (currentExperienceButton.classed('pressed'))
									timeframeName = 'Current';
								else
									timeframeName = 'Goal';
								experienceController.timeframe(timeframeName);

								experienceController.save()
									.then(hidePanel, cr.syncFail);
							}
						}
						catch(err)
						{
							cr.syncFail(err);
						}
					}
				}
				
				if (_this.organizationSearchView.isDirtyText())
				{
					_this.checkOrganizationInput();
				}
				if (_this.siteSearchView.isDirtyText())
				{
					_this.checkSiteInput();
				}
				if (_this.offeringSearchView.isDirtyText())
				{
					_this.checkOfferingInput();
				}
				_this.updateInputs();
				_this.checkTagInput();
						
				if (!experienceController.offeringName() &&
					experienceController.experienceServices().length == 0 &&
					experienceController.customServices().length == 0)
					cr.asyncFail(_this.nameOrTagRequiredMessage);
				else
				{
					doAdd();
				}
				d3.event.preventDefault();
			});
		doneButton.append("span").text(experienceController.oldInstance() ? crv.buttonTexts.done : crv.buttonTexts.add);
		
		if (experienceController.oldInstance())
		{
			bottomNavContainer.appendLeftButton()
				.on("click", 
					function() {
						_this.handleDeleteButtonClick();
					})
				.append("span").classed("text-danger", true).text("Delete");
		}

		var section;
		var label;
		var searchContainer;
		
		/* The tags section. */
		this.tagPoolSection = new TagPoolSection(this, experienceController);
		
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
				
		this.tagPoolSection.fillTags()
			.then(function()
				{
					var tagPoolSection = _this.tagPoolSection;
					
					if (experienceController.serviceLinks().length == 0)
					{
						var tagsContainer = tagPoolSection.section.select('.tags-container');
						var tagInput = tagPoolSection.appendTag(tagsContainer, null);
						tagInput.node().focus();
					}
					else
					{
						var tagInput = tagPoolSection.section.select('.tags-container>input.tag');
						tagInput.node().focus();
					}
				},
				cr.asyncFail);

		/* Code starting for the date range. */
		var birthday = experienceController.parent().birthday() ||
			(function()
			 {
				var todayDate = getUTCTodayDate();
				return "{0}-{1}".format(todayDate.getUTCFullYear() - 100, getMonthString(todayDate));
			 })();
		
		var optionPanel = panel2Div.append('section')
			.classed('date-range-options', true);
		
		optionPanel.append('div')
			.text(this.timeframeLabel);

		var buttonDiv = optionPanel.append('div');
		var previousExperienceButton = buttonDiv.append('button')
			.classed('previous', true)
			.on('click', function()
				{
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', true);
					
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.previousExperienceLabel);
		
		var currentExperienceButton = buttonDiv.append('button')
			.classed('present', true)
			.on('click', function()
				{
					goalButton.classed('pressed', false);
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', true);
					
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.currentExperienceLabel);
		
		var goalButton = buttonDiv.append('button')
			.classed('goal', true)
			.on('click', function()
				{
					previousExperienceButton.classed('pressed', false);
					currentExperienceButton.classed('pressed', false);
					goalButton.classed('pressed', true);
					
					setGoalStartDateRange();
					$(startDateWheel).trigger('change');
					setDateRangeLabels();
				})
			.text(this.goalLabel);
			
		function setDateRangeLabels()
		{
			startDateContainer.select('label')
						.text(goalButton.classed('pressed') ? 'Starts' : 'Started');
			endDateContainer.select('label')
						.text(previousExperienceButton.classed('pressed') ? 'Ended' : 'Ends');
		}
			
		var startDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);

		startDateContainer.append('label')
			.classed('overlined', true)
			.text("Start");
		this.startHidable = this.appendHidableDateInput(startDateContainer, new Date(birthday));
		var startDateWheel = this.startHidable.dateWheel;
		
		$(startDateWheel).on('change', function() {
			var minEndDate, maxEndDate;
			var dateWheelValue = this.value() != '' ? this.value() : null;
			if (previousExperienceButton.classed('pressed'))
			{
				if (dateWheelValue && dateWheelValue.length > 0)
					minEndDate = new Date(dateWheelValue);
				else if (birthday)
					minEndDate = new Date(birthday);
				else
					minEndDate = getUTCTodayDate();
			}
			else if (currentExperienceButton.classed('pressed'))
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
			
			if (previousExperienceButton.classed('pressed'))
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
		
		var endDateContainer = panel2Div.append('section')
			.classed('cell unique date-container', true);
		var endLabel = endDateContainer.append('label')
			.classed('overlined', true)
			.text("End");
			
		this.endHidable = this.appendHidableDateInput(endDateContainer, new Date(birthday));
		var endDateWheel = this.endHidable.dateWheel;
		
		if (experienceController.start())
			startDateWheel.value(experienceController.start());
		else
		{
			if (experienceController.end())
			{
				/* Initialize the start date to a reasonable value, not the current date. */
				var startGuessDate = new Date(experienceController.end());
				startGuessDate.setUTCFullYear(startGuessDate.getUTCFullYear() - 1);
				var startGuessDateString = startGuessDate.toISOString().substring(0, 7);
				if (startGuessDateString < birthday)
					startDateWheel.value(birthday);
				else
					startDateWheel.value(startGuessDateString);
			}
			startDateWheel.clear();
		}
			
		if (experienceController.end())
			endDateWheel.value(experienceController.end());
		else
		{
			if (experienceController.start())
			{
				/* Initialize the end date to a reasonable value. */
				var guessDate = new Date(experienceController.start());
				guessDate.setUTCFullYear(guessDate.getUTCFullYear() + 1);
				var guessDateString = guessDate.toISOString().substring(0, 7);
				endDateWheel.value(guessDateString);
			}
			endDateWheel.clear();
		}
				
		/* The organization section. */
		section = panel2Div.append('section')
			.classed('cell picker organization', true);
				
		this.organizationInput = section.append('input')
			.classed('organization', true)
			.attr('placeholder', this.organizationDefaultPlaceholder)
			.attr('value', experienceController.organizationName());
		organizationHelp = section.append('div')
			.classed('help', true);
			
		searchContainer = section.append('div');
			
		this.organizationSearchView = new OrganizationSearchView(searchContainer.node(), 
																 this, experienceController, 
																 this.organizationInput.node(), 
																 organizationHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell picker site', true);
				
		this.siteInput = section.append('input')
			.classed('site', true)
			.attr('placeholder', this.siteDefaultPlaceholder)
			.attr('value', experienceController.siteName());
		siteHelp = section.append('div').classed('help', true);
		
		searchContainer = section.append('div');
			
		this.siteSearchView = new SiteSearchView(searchContainer.node(), 
												 this, experienceController, 
												 this.siteInput.node(), 
												 siteHelp.node());
		
		section = panel2Div.append('section')
			.classed('cell picker offering', true);
				
		this.offeringInput = section.append('input')
			.classed('offering', true)
			.attr('placeholder', this.offeringDefaultPlaceholder)
			.attr('value', experienceController.offeringName());
		offeringHelp = section.append('div').classed('help', true);
			
		searchContainer = section.append('div');
			
		this.offeringSearchView = new OfferingSearchView(searchContainer.node(), 
														 this, experienceController, 
														 this.offeringInput.node(), 
														 offeringHelp.node());
		
		/* The offering tags section. */
		tagsTopContainer = panel2Div.append('section')
			.classed('cell tags offering', true)
			.append('div');
		label = tagsTopContainer.append('label')
			.append('span')
			.text('Offering Tags:');
		
		tagsTopContainer.append('span')
			.classed('offering-tags-container', true);
		
		function setGoalStartDateRange()
		{
			var startMinDate = getUTCTodayDate();
			var startMaxDate = new Date(startMinDate);
			startMaxDate.setUTCFullYear(startMaxDate.getUTCFullYear() + 50);
			startDateWheel.checkMinDate(startMinDate, startMaxDate);
		}
		
		$(this.node()).one("revealing.cr", function()
			{
				_this.showTags();
				
				if (experienceController.timeframe() == 'Current')
				{
					startDateWheel.onChange();
					currentExperienceButton.classed('pressed', true);
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				else if (experienceController.timeframe() == 'Goal')
				{
					goalButton.classed('pressed', true);
					setGoalStartDateRange();
				}
				else
				{
					startDateWheel.onChange();
					endDateWheel.onChange();
					previousExperienceButton.classed('pressed', true);
					startDateWheel.checkMinDate(new Date(birthday), getUTCTodayDate());
				}
				$(startDateWheel).trigger('change');
				setDateRangeLabels();
			});

		$(panel2Div.node()).on('resize.cr', function()
		{
			_this.resizeVisibleSearch(0);
		});

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
	
	return NewExperiencePanel;
})();

