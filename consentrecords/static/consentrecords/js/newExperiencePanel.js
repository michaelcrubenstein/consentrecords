var OrganizationSearchView = (function() {
	OrganizationSearchView.prototype = new SearchView();
	OrganizationSearchView.prototype.dots = null;
	OrganizationSearchView.prototype.container = null;
	
	OrganizationSearchView.prototype.appendDescriptions = function(buttons)
	{
		var leftText = buttons.append('div').classed("left-expanding-div", true);

		leftText.append('div')
			.classed("sub-text", function(d) { return d.getValue("Organization"); })
			.text(function(d) {
				if (d.getValue("Organization"))
					return d.getValue("Organization").getDescription();
				else
					return d.getDescription();
			});
		leftText.append('div')
			.classed("sub-text", true)
			.text(function(d) { 
				if (d.getValue("Organization"))
					return d.getDescription();
				else
					return "";
			});
	}
			
	OrganizationSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'experience organization: ' + d.getDescription()))
		{
			if (d.getValue("Organization"))
			{
				this.dots.organization = d.getValue("Organization");
				this.dots.site = d;
				this.dots.organizationName = d.getValue("Organization").getDescription();
				this.dots.siteName = d.getDescription();
			}
			else
			{
				this.dots.organization = d;
				this.dots.site = null;
				this.dots.organizationName = d.getDescription();
				this.dots.siteName = null;
			}

			this.inputBox.value = d.getDescription();
			$(this.inputBox).trigger("input");
			if (this.dots.site)
				this.dots.setValue(this.dots.value + 2);
			else
				this.dots.setValue(this.dots.value + 1);
		}
		d3.event.preventDefault();
	}
	
	OrganizationSearchView.prototype.isButtonVisible = function(button, d)
	{
		if (d.getDescription().toLocaleLowerCase().indexOf(this._constrainCompareText) >= 0)
			return true;
		return false;
	}
	
	OrganizationSearchView.prototype.searchPath = function(val)
	{
		if (val.length == 0)
			return "";
		else if (val.length < 3)
			return '(Organization,Site)[_name^="'+val+'"]';
		else
			return '(Organization,Site)[_name*="'+val+'"]';
	}
	
	OrganizationSearchView.prototype.appendSearchArea = function()
	{
		var w = this.container.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		return w.append("section")
			.classed("multiple", true)
			.append("ol");
	}
	
	function OrganizationSearchView(dots, container, placeholder)
	{
		this.dots = dots;
		this.container = container;
		SearchView.call(this, container.node(), placeholder, this.appendDescriptions, GetDataChunker)
	}
	
	return OrganizationSearchView;
})();

var SiteSearchView = (function() {
	SiteSearchView.prototype = new SearchView();
	SiteSearchView.prototype.dots = null;
	SiteSearchView.prototype.container = null;
	
	SiteSearchView.prototype.appendDescriptions = function(buttons)
	{
		buttons.append("div")
			.classed("description-text", true)
			.text(_getDataDescription)
			.each(_pushTextChanged);
		buttons.each(function(site)
		{
			var _button = this;
			var address = site.getValue("Address");
			appendAddress.call(this, address);
		});
	}
			
	SiteSearchView.prototype.onClickButton = function(d, i) {
		if (prepareClick('click', 'experience site: ' + d.getDescription()))
		{
			this.dots.site = d;
			this.dots.siteName = d.getDescription();

			this.inputBox.value = d.getDescription();
			$(this.inputBox).trigger("input");
			this.dots.setValue(this.dots.value + 1);
		}
		d3.event.preventDefault();
	}
	
	SiteSearchView.prototype.isButtonVisible = function(button, d)
	{
		var retVal = false;
		var constrainText = this._constrainCompareText;
		d3.select(button).selectAll('div').each(function()
			{
				retVal |= d3.select(this).text().toLocaleLowerCase().indexOf(constrainText) >= 0;
			});
		return retVal;
	}
	
	SiteSearchView.prototype.searchPath = function(val)
	{
		if (!this.dots.organization)
			return "";
			
		var s = "#"+this.dots.organization.getValueID() + ">Sites>Site";
		if (val.length == 0)
			return s;
		else if (val.length < 3)
			return s + '[_name^="'+val+'"]';
		else
			return s + '[_name*="'+val+'"]';
	}
	
	SiteSearchView.prototype.textCleared = function()
	{
		SearchView.prototype.textCleared.call(this);
		
		if (this.dots.organization)
		{
			this.startSearchTimeout("");
		}
	}
	
	SiteSearchView.prototype.fields = function()
	{
		return ["Address"];
	}
	
	SiteSearchView.prototype.appendSearchArea = function()
	{
		var w = this.container.append('div').classed('body', true)
				  .append('div')
				  .append('div');
		return w.append("section")
			.classed("multiple", true)
			.append("ol");
	}
	
	function SiteSearchView(dots, container, placeholder)
	{
		this.dots = dots;
		this.container = container;
		SearchView.call(this, container.node(), placeholder, this.appendDescriptions, GetDataChunker)
	}
	
	return SiteSearchView;
})();

/* A reported object combines a name and an object value that might be picked. */
var ReportedObject = function () {
	ReportedObject.prototype.name = null;
	ReportedObject.prototype.pickedObject = null;
	
	function ReportedObject(args) {
		if (!("name" in args)) args.name = null;
		if (!("pickedObject" in args)) args.pickedObject = null;
		
		this.name = args.name;
		this.pickedObject = args.pickedObject;
    };
    
    ReportedObject.prototype.getDescription = function()
    {
    	if (this.pickedObject) return this.pickedObject.getDescription();
    	return this.name;
    }
    
    return ReportedObject;
}();

var PickServicePanel = (function () {
	PickServicePanel.prototype = new SitePanel();
	
	PickServicePanel.prototype.getObjectByDescription = function(a, description)
	{
		for (var i = 0; i < a.length; ++i)
		{
			if (a[i].getDescription() == description)
				return a[i];
		}
		return null;
	}

	function PickServicePanel(previousPanelNode, rootObjects, oldReportedObject, dots, success)
	{
		var header = oldReportedObject ? "Marker" : "New Marker";
		SitePanel.call(this, previousPanelNode, rootObjects, header, "list");
		var _this = this;

		var navContainer = _this.appendNavContainer();

		var backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				if (prepareClick('click', 'cancel'))
				{
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		backButton.append("span").text("Cancel");
	
		var addButton = navContainer.appendRightButton()
			.on("click", function()
			{
				if (prepareClick('click', 'add service'))
				{
					if (!dots.getServiceByName(searchInputNode.value))
					{
						var newValue = _this.getObjectByDescription(rootObjects, searchInputNode.value);
						success(new ReportedObject({name: searchInputNode.value, pickedObject: newValue}));
					}
				
					hidePanelRight(_this.node());
				}
				d3.event.preventDefault();
			});
		addButton.append('span').text(oldReportedObject ? 'Change' : 'Add');
		addButton.classed("site-disabled-text", true);
		addButton.classed("site-active-text", false);
	
		navContainer.appendTitle(header);
	
		var textChanged = function(){
			var val = this.value.toLocaleLowerCase();
			if (val.length == 0)
			{
				/* Show all of the items. */
				panel2Div.selectAll("li")
					.style("display", null);
			}
			else
			{
				/* Show the items whose description is this.value */
				panel2Div.selectAll("li")
					.style("display", function(d)
						{
							if (d.getDescription().toLocaleLowerCase().indexOf(val) >= 0)
								return null;
							else
								return "none";
						});
			}
		
			addButton.classed("site-disabled-text", val.length == 0);
			addButton.classed("site-active-text", val.length > 0);
		}

		var searchInputNode = _this.appendSearchBar(textChanged);

		var panel2Div = _this.appendScrollArea();
	
		function buttonClicked(d) {
			if (prepareClick('click', 'pick service: ' + d.getDescription()))
			{
				success(new ReportedObject({pickedObject: d}));
				hidePanelRight(_this.node());
			}
			d3.event.preventDefault();
		}
	
		var buttons = appendButtons(panel2Div, rootObjects, buttonClicked);
	
		if (oldReportedObject)
		{
			if (oldReportedObject.pickedObject)
			{
				buttons.insert("span", ":first-child").classed("glyphicon glyphicon-ok pull-left", 
					function(d) { return d == oldReportedObject.pickedObject; });
			}
			else
			{
				searchInputNode.value = oldReportedObject.getDescription();
				$(searchInputNode).trigger("input");
			}
		}
	
		showPanelLeft(_this.node(), unblockClick);
	}

	return PickServicePanel;
})();

var NewExperiencePanel = (function () {
	NewExperiencePanel.prototype = new SitePanel();
	
	NewExperiencePanel.prototype.addInput = function(p, placeholder)
	{
		var searchBar = p.append("div").classed("searchbar", true);
	
		var searchInputContainer = searchBar.append("div")
			.classed("search-input-container", true);
		
		return searchInputContainer
			.append("input")
			.classed("search-input", true)
			.attr("placeholder", placeholder);
	}

	NewExperiencePanel.prototype.setupPanel2 = function(dots)
	{
		var p = d3.select(this);
		p.append('div')
			.append('p').text("What organization that provided this experience?");

		var searchView = new OrganizationSearchView(dots, p, "Organization", appendDescriptions);

		this.onDoneClicked = function()
		{
			var textValue = searchView.inputBox.value.trim();
			if ((dots.site && textValue != dots.site.getDescription() && textValue != dots.organization.getDescription()) ||
				(!dots.site && dots.organization && textValue != dots.organization.getDescription()) ||
				(!dots.site && !dots.organization))
			{
				dots.organization = null;
				dots.site = null;
				dots.organizationName = textValue;
				dots.siteName = null;
			}
		}
		this.onReveal = null;
	}

	NewExperiencePanel.prototype.setupPanel3 = function(dots)
	{
		var p = d3.select(this);
		var header = p.append('div')
			.append('p');
	
		var searchView = new SiteSearchView(dots, p, "Site");
	
		var nextSearch = "";
		var next = function(dots)
		{
			header.text("Where did " + dots.organizationName + " provide this experience?")
			searchView.clearListPanel();
			searchView.search(nextSearch);				
		};

		this.onDoneClicked = function()
		{
			var textValue = searchView.inputBox.value.trim();
			if ((dots.site && textValue != dots.site.getDescription()) ||
				!dots.site)
			{
				dots.site = null;
				dots.siteName = textValue;
			}
		}
	
		next.call(this, dots);
		nextSearch = undefined;
		this.onReveal = next;
	}

	NewExperiencePanel.prototype.setupOfferingPanel = function(dotsPanel, dots)
	{
		var p = d3.select(dotsPanel);
		p.append('div')
			.append('p').text("What was the name of this experience?");

		var searchInput = this.addInput(p, "Name");

		var w = p.append('div').classed('body', true)
				  .append('div')
				  .append('div');
			  
		next = function(dots)
		{
			w.selectAll('ol').remove();
			w.selectAll('p').remove();
			if (dots.site)
			{
				function done(rootObjects)
				{
					function sortByDescription(a, b)
					{
						return a.getDescription().localeCompare(b.getDescription());
					}

					function buttonClicked(d)
					{
						if (prepareClick('click', 'experience offering: ' + d.getDescription()))
						{
							dots.offering = d;
							dots.offeringName = d.getDescription();
			
							searchInput.node().value = d.getDescription();
							$(searchInput.node()).trigger("input");
							dots.setValue(dots.value + 1);
						}
					}
		
					rootObjects.sort(sortByDescription);
					appendButtons(w, rootObjects, buttonClicked);
				}
	
				cr.getData({path: "#"+dots.site.getValueID() + ">Offerings>Offering", done: done, fail: asyncFailFunction});
			}
			else
			{
				w.append('p').classed('help-text', true)
					.text("For example, the title of a job, the name of a class or musical instrument or the league of a sports program.");
			}
		};

		dotsPanel.onDoneClicked = function()
		{
			var textValue = searchInput.node().value.trim();
			if ((dots.offering && textValue != dots.offering.getDescription()) ||
				!dots.offering)
			{
				dots.offering = null;
				dots.offeringName = textValue;
			}
		}
	
		next.call(dotsPanel, dots);
		dotsPanel.onReveal = next;
	}

	NewExperiencePanel.prototype.setupStartDatePanel = function(dots)
	{
		var p = d3.select(this);
		p.append('div')
			.append('p').text("When did you start " + dots.offeringName + "?");

		var minYear = undefined;	
		var birthday = dots.user.getDatum("Birthday");
		if (birthday)
			minYear = parseInt(birthday.substr(0, 4));

		dots.startDateInput = new DateInput(this, new Date(birthday));
		
		$(dots.startDateInput).on('change', function(eventObject) {
			dots.checkForwardEnabled();
		});
		
		this.onCheckForwardEnabled = function()
		{
			return dots.startDateInput.year && dots.startDateInput.month;
		}	
		this.onReveal = null;
	}
	
	NewExperiencePanel.prototype._getMinEndDate = function(dots)
	{
		if (dots.startDateInput.year)
			return new Date(dots.startDateInput.value());
		else
		{
			var birthday = dots.user.getDatum("Birthday");
			if (birthday)
				return new Date(birthday);
		}
		return undefined;
	}

	NewExperiencePanel.prototype.setupEndDatePanel = function(dotsPanel, dots)
	{
		var p = d3.select(dotsPanel);
		var _this = this;
		p.append('div')
			.append('p').text("When did you finish " + dots.offeringName + "?");
		p.append('div')
			.append('p').classed('site-active-text', true)
			.on('click', function()
				{
					if (prepareClick('click', "It isn't finished."))
					{
						dots.endDateInput.clear();
						dotsPanel.onGoingForward();
					}
				})
			.text("It isn't finished.");

		dots.endDateInput = new DateInput(dotsPanel, this._getMinEndDate(dots))

		dotsPanel.onGoingForward = function(goToNext)
		{
			if ((dots.offering && dots.offering.getCell("Service").data.length > 0) ||
				(dots.services.length > 0))
				dots.setValue(dots.value + 2);
			else
				dots.setValue(dots.value + 1);
		}
		
		dotsPanel.onReveal = function(dots)
		{
			dots.endDateInput.checkMinDate(_this._getMinEndDate(dots))
		}
	}
	
	NewExperiencePanel.prototype.setupConfirmPanel = function(dots)
	{
		var p = d3.select(this);
	
		p.selectAll("*").remove();
	
		var p = d3.select(this)
			.classed('confirm-experience', true);
	
		p.append('div')
			.append('p').text("Add this experience to your pathway?");

		var summary = p.append('div')
			.classed('summary body', true)
			.append('div')
			.append('div');
		if (dots.offeringName)
			summary.append('header').text(dots.offeringName);
	
		orgDiv = summary.append('div').classed("organization", true);		
		if (dots.organizationName)
			orgDiv.append('div').text(dots.organizationName);
			
		if (dots.siteName)
			orgDiv.append('div')
				.classed('address-line', true)
				.text(dots.siteName);
	
		{
			var startDate = dots.startDateInput.value();
			var endDate = dots.endDateInput.value();
			if (startDate && endDate)
				t = startDate + " - " + endDate;
			else if (startDate)
				t = startDate + " - ";
			else if (endDate)
				t = " - " + endDate;
			else
				t = "";
			if (t.length)
			{
				var section = summary.append('section')
					.classed('cell view unique', true);
				section.append('ol')
					.append('li')
					.append('div').classed('string-value-view', true)
					.text(t);
				section.append('div').classed('cell-border-below', true);
			}
		}

		if (dots.services.length > 0 || (dots.offering && dots.offering.getCell("Service").data.length > 0))
		{
			var servicesDiv = summary.append('section')
				.classed('cell view multiple', true);
		
			servicesDiv.append('label').text("Markers");
			var itemsDiv = servicesDiv.append('ol');
		
			if (dots.offering)
			{
				appendItems(itemsDiv, dots.offering.getCell("Service").data)	
					.append('div')
					.classed('multi-line-item', true)
					.append('div')
					.classed('description-text string-value-view', true)
					.text(function(d) { return d.getDescription(); });
			}
		
			appendItems(itemsDiv, dots.services)	
				.append('div')
				.classed('multi-line-item', true)
				.append('div')
				.classed('description-text string-value-view', true)
				.text(function(d) { return d.getDescription(); });
			servicesDiv.append('div').classed("cell-border-below", true);
		}
	}

	NewExperiencePanel.prototype.setupFirstMarkerPanel = function(dotsPanel, dots)
	{
		var p0 = d3.select(dotsPanel);
		p0.append('div')
			.append('p').text("Every experience leaves some marker along your pathway that describes what you got from that experience.");
		p0.append('div')
			.append('p').text("Choose one of the markers below, or create your own marker. If more than one marker applies, pick one and then you can add others.");
		
		var searchInput = this.addInput(p0, "Experience");
	
		var lastText = "";	
		$(searchInput.node()).on("keyup input paste", function(e) {
			if (lastText != this.value)
			{
				lastText = this.value;
				if (lastText.length == 0)
				{
					/* Show all of the items. */
					p0.selectAll("li")
						.style("display", "block");
				}
				else
				{
					/* Show the items whose description is this.value */
					p0.selectAll("li")
						.style("display", function(d)
							{
								if (d.getDescription().toLocaleLowerCase().indexOf(lastText.toLocaleLowerCase()) >= 0)
									return null;
								else
									return "none";
							});
				}
			}
		});

		function done(rootObjects)
		{
			function sortByDescription(a, b)
			{
				return a.getDescription().localeCompare(b.getDescription());
			}

			function buttonClicked(d)
			{
				if (prepareClick('click', 'experience first marker: ' + d.getDescription()))
				{
					if (dots.services.length > 0)
					{
						/* Remove this item if it is farther down in the list. */
						for (var i = 1; i < dots.services.length; ++i)
							if (dots.services[i].pickedObject == d)
							{
								dots.services.splice(i, 1);
								break;
							}
						dots.services[0] = new ReportedObject({pickedObject: d});
					}
					else
						dots.services.push(new ReportedObject({pickedObject: d}));
			
					searchInput.node().value = d.getDescription();
					$(searchInput.node()).trigger("input");
					dots.setValue(dots.value + 1);
				}
			}
		
			rootObjects.sort(sortByDescription);
			p0.datum(rootObjects);
			var w = p0.append('div').classed('body', true)
					  .append('div')
					  .append('div');
			appendButtons(w, rootObjects, buttonClicked);
		}
	
		p0.node().onDoneClicked = function()
		{
			var newName = searchInput.node().value.trim();
		
			/* Identify if the new name matches the name of an existing service. */
			var newValue = null;
			var rootObjects = p0.datum();
			for (i = 0; i < rootObjects.length; i++)
			{
				if (rootObjects[i].getDescription() == newName)
				{
					newValue = rootObjects[i];
					break;
				}
			}
		
			if (dots.services.length > 0)
			{
				for (var i = 1; i < dots.services.length; ++i)
				{
					if (newName == dots.services[i].getDescription())
					{
						dots.services.splice(i, 1);
						break;
					}
				}
				dots.services[0] = new ReportedObject({name: newName, pickedObject: newValue});
			}
			else if (newName.length > 0)
				dots.services.push(new ReportedObject({name: newName, pickedObject: newValue}));
		}
		crp.getData({path: "Service", done: done, fail: asyncFailFunction});
		dotsPanel.onReveal = null;
	}

	NewExperiencePanel.prototype.setupServicesPanel = function(dots)
	{
		var sitePanelNode = $(this).parents("panel.site-panel")[0];
		var p1 = d3.select(this);
		var header = p1.append('div')
			.append('p');
		
		if (dots.offering && dots.offering.getCell("Service").data.length > 0)
			header.text("Markers indicate the type or the benefit of this experience.");
		else
			header.text("Some experiences need more than one marker, such as being the captain of a soccer team or getting a summer job working with computers.");

		var obj = p1.append('div')
			.classed('body', true)
			.append('div')
			.append('section')
			.classed("cell multiple", true);
		
		var labelDiv = obj.append('label')
			.text("Markers");
		
		var itemsDiv = obj.append("ol").classed("panel-fill", true);

		itemsDiv.classed("border-above", true);

		var clickFunction;
		clickFunction = function(d) {
				var _this = this;
				if (prepareClick('click', 'marker: ' + d.getDescription()))
				{
					crp.getData({path: "Service", 
					done: function(rootObjects)
					{
						var success = function(newReportedObject)
						{
							var divs = d3.select($(_this).parents("li")[0]);
							/* Set the datum for the li and this object so that the correct object is used in future clicks. */
							divs.datum(newReportedObject);
							d3.select(_this).datum(newReportedObject);
							var s = divs.selectAll(".description-text").text(newReportedObject.getDescription());
							dots.services[dots.services.indexOf(d)] = newReportedObject;
						}
						new PickServicePanel(sitePanelNode, rootObjects, d, dots, success);
					}, 
					fail: syncFailFunction});
				}
			};
	
		function appendOfferingServices()
		{
			if (dots.offering != null)
			{
				var fixedDivs = appendItems(itemsDiv, dots.offering.getCell("Service").data);
				var itemDivs = fixedDivs.append("div")
					.classed("multi-row-content", true)
				appendButtonDescriptions(itemDivs);
			}
		}
	
		function _confirmDeleteClick(d)
		{
			var a = dots.services;
			a.splice($.inArray(d, a), 1);
			var item = $(this).parents("li")[0];
			$(item).animate({height: "0px"}, 200, 'swing', function() { $(item).remove(); });
		}

		function appendServices(services)
		{
			var divs = appendItems(itemsDiv, services);
			appendConfirmDeleteControls(divs)
				.on('click', _confirmDeleteClick);
		
			var buttons = appendRowButtons(divs);
			buttons.on("click", clickFunction);
			appendDeleteControls(buttons);
			appendRightChevrons(buttons);
			appendButtonDescriptions(buttons);
		}
	
		appendOfferingServices();
		appendServices(dots.services);
	
		/* Add one more button for the add Button item. */
		var buttonDiv = obj.append("div")
			.append("button").classed("btn row-button multi-row-content site-active-text border-above border-below", true)
			.on("click", function(cell) {
				var _thisButton = this;
				if (prepareClick('click', 'add marker'))
				{
					crp.getData({path: "Service", 
					done: function(rootObjects)
					{
						var success = function(newReportedObject)
						{
							dots.services.push(newReportedObject);
							appendServices([newReportedObject]);
						}
						new PickServicePanel(sitePanelNode, rootObjects, null, dots, success);
					}, 
					fail: syncFailFunction});
				}
				d3.event.preventDefault();
			})
			.append("div").classed("pull-left", true);
		buttonDiv.append("span").classed("glyphicon glyphicon-plus", true);
		buttonDiv.append("span").text(" add marker");
	
		this.onReveal = function()
		{
			itemsDiv.selectAll('li').remove();
			appendOfferingServices();
			appendServices(dots.services);
		}
	
		this.onGoingBack = function()
		{
			if (dots.offering && dots.offering.getCell("Service").data.length > 0 ||
				dots.services.length > 0)
				dots.setValue(dots.value - 2);
			else
				dots.setValue(dots.value - 1);
		}		
	}

	function NewExperiencePanel(pathway, previousPanelNode) {
		var header = "Add Experience";
		SitePanel.call(this, previousPanelNode, null, header, "edit new-experience-panel");
			
		var navContainer = this.appendNavContainer();

		var panel2Div = this.appendScrollArea()
			.classed("vertical-scrolling", false)
			.classed("no-scrolling", true);
		
		var dots = new DotsNavigator(panel2Div, 8);	
		dots.finalText = "Add";
		dots.user = pathway.user;

		var _this = this;
		var hideSuccessFunction = function()
			{
				bootstrap_alert.show($('.alert-container'), "Adding Experience To Your Pathway...", "alert-info");

				var moreExperiencesObject = dots.user.getValue("More Experiences");
				
				function successFunction3(newData)
				{
					newData.checkCells([],
						function() {
							pathway.addMoreExperience.call(pathway, newData);
							_this.hidePanelDown();
						},
						syncFailFunction);
				}
				
				function successFunction2(newData)
				{
					if (newData != moreExperiencesObject)
					{
						var cell = dots.user.getCell("More Experiences");
						cell.addValue(newData);
						moreExperiencesObject = dots.user.getValue("More Experiences");
					}
					
					field = {ofKind: "More Experience", name: "More Experience"};
					var initialData = {};
					var startDate = dots.startDateInput.value();
					var endDate = dots.endDateInput.value();
					
					if (startDate.length > 0)
						initialData["Start"] = [{text: startDate}];
					if (endDate.length > 0)
						initialData["End"] = [{text: endDate}];
						
					if (dots.organization)
						initialData["Organization"] = [{instanceID: dots.organization.getValueID()}];
					else if (dots.organizationName)
						initialData["User Entered Organization"] = [{text: dots.organizationName}];
						
					if (dots.site)
						initialData["Site"] = [{instanceID: dots.site.getValueID()}];
					else if (dots.siteName)
						initialData["User Entered Site"] = [{text: dots.siteName}];
						
					if (dots.offering)
						initialData["Offering"] = [{instanceID: dots.offering.getValueID()}];
					else if (dots.offeringName)
						initialData["User Entered Offering"] = [{text: dots.offeringName}];
						
					for (i = 0; i < dots.services.length; ++i)
					{
						var s = dots.services[i];
						if (s.pickedObject)
						{
							if (!initialData["Service"])
								initialData["Service"] = [{instanceID: s.pickedObject.getValueID()}];
							else
								initialData["Service"].push({instanceID: s.pickedObject.getValueID()});
						}
						else if (s.name)
						{
							if (!initialData["User Entered Service"])
								initialData["User Entered Service"] = [{text: s.name}];
							else
								initialData["User Entered Service"].push({text: s.name});
						}
					}
					
					cr.createInstance(field, moreExperiencesObject.getValueID(), initialData, successFunction3, syncFailFunction);
				}
				
				if (moreExperiencesObject && moreExperiencesObject.getValueID())
				{
					successFunction2(moreExperiencesObject);
				}
				else
				{
					field = {ofKind: "More Experiences", name: "More Experiences"};
					cr.createInstance(field, dots.user.getValueID(), [], successFunction2, syncFailFunction);
				}
			};

		dots.appendForwardButton(navContainer, hideSuccessFunction);
		dots.appendBackButton(navContainer, function() {
			_this.hidePanelDown();
		});
		
		navContainer.appendTitle(header);
		
		dots.nthPanel(0).onReveal = this.setupPanel2;
		dots.nthPanel(1).onReveal = this.setupPanel3;
		dots.nthPanel(2).onReveal = function(dots) { _this.setupOfferingPanel(this, dots); };
		dots.nthPanel(3).onReveal = this.setupStartDatePanel;
		dots.nthPanel(4).onReveal = function(dots) { _this.setupEndDatePanel(this, dots); };
		dots.nthPanel(5).onReveal = function(dots) { _this.setupFirstMarkerPanel(this, dots); };
		dots.nthPanel(6).onReveal = this.setupServicesPanel;
		dots.nthPanel(7).onReveal = this.setupConfirmPanel;
				
		showPanelUp(this.node(), unblockClick);
		dots.showDots();
	}
	
	return NewExperiencePanel;
})();

