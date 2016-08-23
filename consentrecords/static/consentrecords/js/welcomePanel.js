var WelcomePanel = (function () {
	WelcomePanel.prototype = new SitePanel();
	
	WelcomePanel.prototype.handleResize = function()
	{
		var ol = $(this.mainDiv.node()).children('ol');
		var li = ol.children('li');
		var activeIndex = ol.children('li.active').index();
		var width = this.scrollAreaWidth();
		li.css('left', function(i)
			{
				return "{0}px".format(i < activeIndex ? -width :
					   				  i == activeIndex ? 0 : width);
			});
			
		var _this = this;
		var subOLs = li.find('ol');
		subOLs.each(function()
			{
				var subOL = $(this);
				var subLI = subOL.children('li');
				var subActiveIndex = ol.children('li.active').index();
				var subWidth = _this.scrollAreaWidth();
				subLI.css('left', function(i)
					{
						return "{0}px".format(i < subActiveIndex ? -subWidth :
					   						  i == subActiveIndex ? 0 : subWidth);
					});
			});
		this.mainDiv.selectAll('li svg.pathway')
			.attr('height', function() { 
				return _this.scrollAreaHeight() - $(this).position().top - 45;
			});
	}
	
	WelcomePanel.prototype.hideLastRightButton = function()
	{
		var div1 = $(this.mainDiv.node()).find('div.right>div');
		var offset = div1.children(':first-child').outerWidth(true);
		div1.children().animate({left: "{0}px".format(-offset)});
	}

	WelcomePanel.prototype.showLastRightButton = function()
	{
		var div1 = $(this.mainDiv.node()).find('div.right>div');
		var offset = div1.children(':first-child').outerWidth(true) +
					 div1.children(':nth-child(2)').outerWidth(true);
		div1.children().animate({left: "{0}px".format(-offset)});
	}
	
	WelcomePanel.prototype.highlightLabels = function(svg, index)
	{
		function highlight(tspan, isBold)
		{
			var newWeight = isBold ? 700 : 400;
			var newFill = isBold ? '#222222' : '#666666';
			tspan.css({'font-weight': newWeight, 
					   fill: newFill, 
					   transition: '0.7s'});
		}
		
		highlight(svg.find('g.labels text tspan:nth-child(1)'), index == 0);
		highlight(svg.find('g.labels text tspan:nth-child(2)'), index == 0);
		highlight(svg.find('g.labels text tspan:nth-child(3)'), index == 1);
		highlight(svg.find('g.labels text tspan:nth-child(4)'), index == 2);
		highlight(svg.find('g.labels text tspan:nth-child(5)'), index == 3);
	}
	
	WelcomePanel.prototype.showPrevious = function()
	{
		var _this = this;
		var ol = $(this.mainDiv.node()).children('ol');
		
		var curPanel = ol.children('li.active');
		var subPanels = curPanel.find('ol');
		if (subPanels)
		{
			var curSubPanel = subPanels.children('li.active');
			if (curSubPanel.size())
			{
				var prevSubPanel = curSubPanel.prev('li');
				if (prevSubPanel.size())
				{
					if (prepareClick('click', 'prev welcome subpanel'))
					{
						curSubPanel
							.animate({left: "{0}px".format(_this.scrollAreaWidth())},
									 700,
									 function()
									 {
										d3.select(this).classed('active', false);
									 });
						prevSubPanel
							.animate({left: "{0}px".format(0)},
									 700,
									 function()
									 {
										d3.select(this).classed('active', true);
										unblockClick();
									 });
									 
						var svg = curPanel.find('svg.experience-detail');
						if (svg.size() > 0)
						{
							var subPanelIndex = prevSubPanel.index();
							this.highlightLabels(svg, prevSubPanel.index());
						}			 

						if (curPanel.next().size() == 0 &&
							curSubPanel.next().size() == 0)
						{
							this.hideLastRightButton();
						}
						return;
					}
				}
			}
		}
		
		var prevPanel = curPanel.prev('li');
		var activeIndex = curPanel.index();
		if (curPanel.size())
		{
			if (prepareClick('click', 'prev welcome panel {0}'.format(activeIndex)))
			{
				curPanel
					.animate({left: "{0}px".format(_this.scrollAreaWidth())},
							 700,
							 function()
							 {
								d3.select(this).classed('active', false);
							 });

				prevPanel
					.animate({left: "{0}px".format(0)},
							 700,
							 function()
							 {
								d3.select(this).classed('active', true);
								var isFirst = $(this).index() == 0;
								_this.mainDiv.selectAll('div.left')
									.style('display', isFirst ? "none" : null);
								unblockClick();
							 });
							 
				if (prevPanel.get(0) == ol.children('li:nth-child(1)').get(0))
				{
					var div1 = $(_this.mainDiv.node()).find('div.right>div');
					var offset = div1.width() - div1.children(':first-child').outerWidth(false);
					div1.children().animate({left: "{0}px".format(offset)});
				}
				else if (curPanel.get(0) == ol.children('li:last-child').get(0))
				{
					this.hideLastRightButton();
				}
			}
		}
	}

	WelcomePanel.prototype.showNext = function()
	{
		var _this = this;
		var ol = $(this.mainDiv.node()).children('ol');
		
		var curPanel = ol.children('li.active');
		var subPanels = curPanel.find('ol');
		if (subPanels)
		{
			var curSubPanel = subPanels.children('li.active');
			if (curSubPanel.size())
			{
				var nextSubPanel = curSubPanel.next('li');
				if (nextSubPanel.size())
				{
					if (prepareClick('click', 'next welcome subpanel'))
					{
						curSubPanel
							.animate({left: "{0}px".format(-_this.scrollAreaWidth())},
									 700,
									 function()
									 {
										d3.select(this).classed('active', false);
									 });
						nextSubPanel
							.animate({left: "{0}px".format(0)},
									 700,
									 function()
									 {
										d3.select(this).classed('active', true);
										_this.mainDiv.selectAll('div.left')
											.style('display', null);
										unblockClick();
									 });
						
						var svg = curPanel.find('svg.experience-detail');
						if (svg.size() > 0)
						{
							var subPanelIndex = nextSubPanel.index();
							this.highlightLabels(svg, nextSubPanel.index());
						}			 

						if (curPanel.next().size() == 0 &&
							nextSubPanel.next().size() == 0)
						{
							this.showLastRightButton();
						}
						return;
					}
				}
			}
		}
		
		var nextPanel = curPanel.next('li');
		var activeIndex = curPanel.index();
		if (nextPanel.size())
		{
			if (prepareClick('click', 'next welcome panel {0}'.format(activeIndex)))
			{
				curPanel
					.animate({left: "{0}px".format(-_this.scrollAreaWidth())},
							 700,
							 function()
							 {
								d3.select(this).classed('active', false);
							 });
							 
				nextPanel
					.animate({left: "{0}px".format(0)},
							 700,
							 function()
							 {
								d3.select(this).classed('active', true);
								_this.mainDiv.selectAll('div.left')
									.style('display', null);
								unblockClick();
							 });
				if (curPanel.get(0) == ol.children('li:nth-child(1)').get(0))
				{
					var div1 = $(_this.mainDiv.node()).find('div.right>div');
					var offset = div1.children(':first-child').outerWidth(true);
					div1.children().animate({left: "{0}px".format(-offset)});
				}
				else if (nextPanel.next().size() == 0)
				{
					if (nextPanel.find('ol').size() == 0)
						this.showLastRightButton();
				}
			}
		}
	}
	
	
	function WelcomePanel(previousPanel, onPathwayCreated) {
		var _this = this;
		SitePanel.call(this, previousPanel, null, "Welcome", "welcome");
		var navContainer = this.appendNavContainer();

		if (!cr.signedinUser.getValueID())
		{
			var signinSpan = navContainer.appendRightButton()
				.on("click", function()
					{
						showClickFeedback(this);
						if (prepareClick('click',  'Sign In button'))
						{
							showFixedPanel(_this.node(), "#id_sign_in_panel");
						}
						d3.event.preventDefault();
					})
				.append('span').text('Sign In');
		}
		else
		{
			navContainer.appendLeftButton()
				.on("click", function()
					{
						_this.handleCloseDownEvent();
					})
				.append('span').text('Done');
		}
			
		navContainer.appendTitle("PathAdvisor");
		
		var panel2Div = this.appendScrollArea();
		
		var panelData = 
			[
				[
					{text: "What Is Your Path?",
					 cssClass: "title",
					},
					{url: "/static/consentrecords/svg/welcomepathway.svg",
					 cssClass: "center max-height",
					},
				],
				[
					{text: "Here you can answer three important questions:",
					},
					{text: "What opportunities are available to someone like me?",
					 cssClass: "indent1",
					},
					{text: "What experiences would be valuable in meeting my goals?",
					 cssClass: "indent1",
					},
					{text: "How do I tell my story to others that can help me?",
					 cssClass: "indent1",
					},
					{text: "To answer these questions, you can build your path using PathAdvisor and see the paths of others.",
					},
				],
				[
					{text: "Your path is built from the experiences you have had and goals you set for yourself.",
					 cssClass: "indent1",
					},
					{text: "An experience is any activity you have done that affects who you are or how you can describe yourself to others.",
					 cssClass: "indent1",
					},
					{text: "Types of Experiences",
					 cssClass: "heading1",
					},
					{url: "/static/consentrecords/svg/experiencetypes.svg",
					},
				],
				[
					{text: "Let's take a look at an experience:",
					},
					{url: "/static/consentrecords/svg/experiencedetail.svg",
					 cssClass: "center",
					},
					{panels:
						[
							[
								{text: "Name and Organization",
								 cssClass: "indent1",
								},
								{text: "Most experiences can be described by the name of a program or service provided " +
									   " and the name of the organization that provided the experience.",
								 cssClass: "indent2",
								},
								{text: "The organization for an experience is optional.",
								 cssClass: "indent2"
								},
							],
							[
								{text: "Location",
								 cssClass: "indent1",
								},
								{text: "For large organizations that provide experiences in more than one location, the location where " +
									   "the experience was provided. The location may be the name of a place (such as the name of a school) " +
									   "or a physical address.",
								 cssClass: "indent2",
								},
								{text: "The location for an experience is optional.",
								 cssClass: "indent2",
								},
							],
							[
								{text: "Start Date and End Date",
								 cssClass: "indent1",
								},
								{text: "The dates when the experience started and ended. When you specify dates, " +
									   "the year and month are required. The day of the month is optional.",
								 cssClass: "indent2",
								},
								{text: "When you create a previous experience, you must specify the start date and the end date.",
								 cssClass: "indent2",
								},
								{text: "When you create a current experience, you must specify the start date. The end date is optional.",
								 cssClass: "indent2",
								},
								{text: "When you create a goal, the start date and the end date are both optional.",
								 cssClass: "indent2",
								},
							],
							[
								{text: "Tags",
								 cssClass: "indent1",
								},
								{text: "Finally, tags are used to identify a specific type of experience, the benefits " +
									   "an experience provides or values you achieved from an experience.",
								 cssClass: "indent2",
								},
								{text: "When looking for pathways similar to yours, " +
									   "others may have had similar experiences, but the experiences had different names or are at " +
									   "different places. By comparing tags, you can identify similar experiences.",
								 cssClass: "indent2",
								},
							],
						]
					}
				],
			];
		var ol = panel2Div.append('ol');
			
	    <!-- Indicators -->
		var li = ol.selectAll('li')
			.data(panelData)
			.enter()
			.append('li')
			.each(function(d, i) {
				var mc = new Hammer(this);
				
				mc.on('panleft', function() { 
					_this.showNext(); 
				});
				
				if (i > 0)
				{
					mc.on('panright', function() { 
						_this.showPrevious(); 
					});
				}
			});
			
		ol.select('li:nth-child(1)')
			.classed('active', true);
			
		var divs = li.append('div');
			
		var p = divs.selectAll('p')
			.data(function(d) { return d; })
			.enter()
			.append('p')
			.text(function(d) { return d.text; })
			.each(function(d) {
					if (d.cssClass)
						d3.select(this).classed(d.cssClass, true);
					if (d.url)
					{
						var _thisParagraph = this;
						$.get(d.url).done(function(x)
							{
								d3Paragraph = d3.select(_thisParagraph);
								var s = x.children[0].outerHTML;
								if (d3Paragraph.classed('max-height'))
								{
									var sp = $(_thisParagraph).scrollParent();
									var newHeight = sp.height() - $(_thisParagraph).position().top - 45;
									s = s.replace(/-0px/g, '{0}px'.format(newHeight));
								}
								
								d3Paragraph.html(s);
								var svg = d3Paragraph.select('svg.pathway');
								if (svg.size() > 0)
								{
									svg.selectAll('g.flag>rect')
										.attr('width', function(fd)
											{
												return $(this.parentNode).children('text').outerWidth(false) + 5;
											});	
								}
								else if (d3Paragraph.select('svg.experience-detail').size() > 0)
								{
									svg = d3Paragraph.select('svg.experience-detail');
									function highlight(tspan)
									{
										tspan.style('font-weight', 'bold')
											.style('fill', '#222');
									}
									
									highlight(svg.selectAll('g.labels text tspan:nth-child(1)'));
									highlight(svg.selectAll('g.labels text tspan:nth-child(2)'));
								}
							});
					}
					else if (d.panels)
					{
						var _thisParagraph = this;
						d3Paragraph = d3.select(_thisParagraph);
						var subLI = d3Paragraph.append('ol').selectAll('li')
							.data(d.panels)
							.enter()
							.append('li');
						var subDivs = subLI.append('div');
						subDivs.selectAll('p')
							.data(function(d) { return d; })
							.enter()
							.append('p')
							.text(function(d) { return d.text; })
							.each(function(d) {
									if (d.cssClass)
										d3.select(this).classed(d.cssClass, true);
								});
								
						$(subLI.node()).addClass('active');
					}
			});
		
		ol.select('li:first-child')
			.append('span')
			.classed('about-organizations site-active-text', true)
			.text('For Organizations')
			.on('click', function()
				{
					if (prepareClick('click', 'For Organizations'))
					{
						var panel = new WelcomeOrganizationPanel(_this.node());
						showPanelUp(panel.node(), unblockClick);
					}
				});
		
		var leftControl = panel2Div.append('div')
			.classed('left site-active-text', true)
			.attr('role', 'button')
			.style('display', 'none')
			.on("click", function() { _this.showPrevious(); });
		
		appendLeftChevronSVG(leftControl)
				.classed('chevron', true);
			
		var rightControl = panel2Div.append('div')
			.classed('right site-active-text', true)
			.attr('role', 'button')
			.on("click", function() {
				var curPanel = $(ol.selectAll('li.active:last-child').node());
				if (curPanel.size() > 0)
				{
					subOL = curPanel.find('ol');
					if (subOL.size() > 0)
					{
						if (subOL.children('li.active').next().size() == 0)
						{
							if (cr.signedinUser.getValueID())
								return;
								
							if (prepareClick('click', 'Get Started'))
							{
								var signUp = new Signup(_this.node());
								return;
							}
						}
					}
				}
				
				_this.showNext();
			});
		
		var div1 = rightControl.append('div');

		var learnMoreSpan = div1
			.append('span')
			.classed('learn-more', true)
			.text('Learn More')
			.style('display', 'none');

		var rightChevronSpan = div1.append('span');
		
		appendRightChevronSVG(rightChevronSpan)
			.classed('chevron', true);	

		var getStartedSpan = div1
			.append('span')
			.classed('get-started', true)
			.text(cr.signedinUser.getValueID() ? '' : 'Get Started')
			.style('display', 'none');
		
		setTimeout(function()
			{
				var jNode = $(div1.node());
				jNode.width(
					Math.max($(learnMoreSpan.node()).outerWidth(false), 
							 $(rightChevronSpan.node()).outerWidth(false),
							 $(getStartedSpan.node()).outerWidth(false)));

				jNode.children().each(function()
					{
						$(this).css('margin-left', "{0}px".format(jNode.width() - $(this).outerWidth(false)));
					});
				var offset = jNode.width() - jNode.children(':first-child').outerWidth(false);
				jNode.children().css('left', "{0}px".format(offset))
					.css('display', '');
			});
			
		var signedIn = function(eventObject) {
			var pathwayPanel = new PathlinesPanel(cr.signedinUser, previousPanel, false);
			pathwayPanel.pathtree.setUser(cr.signedinUser.getValue("More Experiences"), true);
			showPanelLeft(pathwayPanel.node(),
				function()
				{
					if (onPathwayCreated)
						onPathwayCreated(pathwayPanel);
					$(_this.node()).remove();
				});
			
		};
		
		$(this.mainDiv.node()).on("resize.cr", function()
			{
				_this.handleResize();
			});
		
		$(cr.signedinUser).on("signin.cr", null, this.node(), signedIn);
		$(this.node()).on("remove", null, function()
			{
				$(cr.signedinUser).off("signin.cr", null, signedIn);
			});
	}
	
	return WelcomePanel;
})();

