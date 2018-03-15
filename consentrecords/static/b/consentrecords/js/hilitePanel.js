var HilitePanel = (function () {
	HilitePanel.prototype = Object.create(EditPanel.prototype);
	HilitePanel.prototype.constructor = HilitePanel;
	
	HilitePanel.prototype.gotIt = "Continue";

	HilitePanel.prototype.panelNode = null;
	HilitePanel.prototype.hilitedElement = null;
	HilitePanel.prototype.helpSpanNode = null;
	HilitePanel.prototype.gotItNode = null;

	HilitePanel.prototype.hide = function()
	{
		var _this = this;
		$(this.panel.node()).trigger('hiding.cr');
		return $.when($(this.panel.node()).animate({opacity: 0}),
					  $(this.canvas.node()).animate({opacity: 0}),
					  $(this.helpSpanNode).animate({opacity: 0}),
					  $(this.gotItNode).animate({opacity: 0}))
				.then(function()
					{
						_this.panel.remove();
						_this.canvas.remove();
						$(_this.helpSpanNode).remove();
						$(_this.gotItNode).remove();
					});
	}
	
	HilitePanel.prototype.showPanel = function()
	{
		return $.when($(this.panel.node()).animate({opacity: 1}),
					  $(this.canvas.node()).animate({opacity: 1}),
					  $(this.helpSpanNode).animate({opacity: 1}),
					  $(this.gotItNode).animate({opacity: 1}))
	}
	
	HilitePanel.prototype.hiliteBoundingRect = function()
	{
		return this.hilitedElement.getBoundingClientRect();
	}
	
	HilitePanel.prototype.hilitePosition = function()
	{
		var p = $(this.hilitedElement).position();
		var p2 = $(this.panelNode).position();
		p.left -= p2.left;
		p.top -= p2.top;
		return p;
	}
	
	HilitePanel.prototype.fillCanvas = function()
	{
		var r = this.hiliteBoundingRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r0 = 0;

		$(this.panel.node()).width(r2.width)
							.height(r2.height);
		
		this.canvas.attr('width', r2.width)
				   .attr('height', r2.height);

		var topHeight = Math.max(r.top - 30, 0);	  
		$(this.aboveDiv.node()).width(r2.width)
							.height(topHeight)
							.css({left: 0, top: 0});
		$(this.leftSpan.node()).width(Math.max(0, r.left - 30))
							.height(r.height + 60)
							.css({left: 0, top: r.top - 30});
		$(this.centerSpan.node()).width(r.width + 60)
							.height(r.height + 60)
							.css({left: r.left - 30, top: r.top - 30});
		$(this.rightSpan.node()).width(Math.max(0, r2.width - (r.left + r.width + 30)))
							.height(r.height + 60)
							.css({left: r.left + r.width + 30, top: r.top - 30});
		$(this.belowDiv.node()).width(r2.width)
							.height(Math.max(0, r2.height - (r.top + r.height + 30)))
							.css({left: 0, top: r.top + r.height + 30});
				  
	}
	
	HilitePanel.prototype.onClose = function()
	{
		if (prepareClick('click', 'Close HilitePanel'))
		{
			this.onCompleteClick()
				.then(unblockClick, cr.syncFail);
		}
	}
	
	HilitePanel.prototype.onTipLevelUpdated = function()
	{
		var _this = this;
		return this.hide()
			.then(function()
				{
					$(this.panelNode).off('resize.cr', this.fillCanvasFunction);
				},
				cr.chainFail);
	}
	
	HilitePanel.prototype.onCompleteClick = function()
	{
		var _this = this;
		
		var tipLevelMask = this.tipLevelMask || 7;
		var newTipLevel = (cr.signedinUser.tipLevel() & ~tipLevelMask) + this.tipLevel;
		return cr.signedinUser.update({'tip level': newTipLevel})
			.then(function()
				{
					_this.onTipLevelUpdated();
				},
				cr.syncFail);
	}
	
	function HilitePanel(hilitedPanel, hilitedElement) {
			
		var _this = this;
		
		this.hilitedPanel = hilitedPanel;
		this.panelNode = hilitedPanel.node();
		this.hilitedElement = hilitedElement;
		
		this.fillCanvasFunction = function() { _this.fillCanvas(); };

		this.panel = d3.select(this.panelNode).append('panel')
			.classed('hilite', true)
			.style('top', 0)
			.style('opacity', 0)
			.on('click', function()
				{
					_this.onClose();
				});
		
		this.aboveDiv = this.panel.append('div')
			.classed('surrounding', true);
		this.leftSpan = this.panel.append('span')
			.classed('surrounding', true);
		this.centerSpan = this.panel.append('span')
			.classed('hiliting', true);
		this.rightSpan = this.panel.append('span')
			.classed('surrounding', true);
		this.belowDiv = this.panel.append('div')
			.classed('surrounding', true);

		this.canvas = d3.select(this.panelNode)
			.append('canvas')
			.classed('hilite', true)
			.style('top', 0)
			.style('opacity', 0);
		
		setTimeout(function()
			{
				try {
					_this.showPanel();
					_this.fillCanvas(); 
				}
				catch (err) { cr.asyncFail(err); }
			});
		$(this.panelNode).on('resize.cr', this.fillCanvasFunction);
		
		this.helpSpanNode = d3.select(this.panelNode).append('span')
			.classed('hilite-help', true)
			.text(this.helpText)
			.node();
		this.gotItNode = d3.select(this.panelNode).append('span')
			.classed('hilite-got-it', true)
			.text(this.gotIt)
			.on('click', function()
				{
					_this.onClose();
				})
			.node();
		
		this.emToPx = parseFloat($(this.helpSpanNode).css('font-size'));
		this.helpMaxWidth = $(this.helpSpanNode).outerWidth();
		this.gotItWidth = $(this.gotItNode).outerWidth();
	}
	
	return HilitePanel;
})();

var ButtonHilitePanel = (function()
{
	ButtonHilitePanel.prototype = Object.create(HilitePanel.prototype);
	ButtonHilitePanel.prototype.constructor = ButtonHilitePanel;
		
	ButtonHilitePanel.prototype.drawArrow = function()
	{
		var ctx = this.canvas.node().getContext('2d');

		var r = this.hiliteBoundingRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var $helpNode = $(this.helpSpanNode);
		var startPointX = parseFloat($helpNode.css('left')) + $helpNode.width() + 3;
		var startPointY = parseFloat($helpNode.css('top')) + $helpNode.innerHeight() / 2;
		var pos = this.hilitePosition();
		var endPointX = pos.left + r.width / 2 - r1;
		var endPointY = pos.top + r.height / 2 + 5;
		var quadPointX1 = (startPointX + endPointX) / 2 + 5;
		var quadPointY1 = startPointY;
		var quadPointX2 = (startPointX + endPointX) / 2 - 5;
		var quadPointY2 = endPointY;
		var anglePointX = (quadPointX1 / 6) + (quadPointX2 / 6 * 5);
		var anglePointY = (quadPointY1 / 6) + (quadPointY2 / 6 * 5);

		ctx.strokeStyle = "rgb(255,255,255)";
		ctx.lineWidth = 2.3;

		var arrowAngle = Math.atan2(anglePointX - endPointX, anglePointY - endPointY) + Math.PI;
		var arrowWidth = 12;

		ctx.beginPath();
		ctx.moveTo(startPointX, startPointY);

		ctx.bezierCurveTo(quadPointX1, quadPointY1, quadPointX2, quadPointY2, endPointX, endPointY);

		ctx.moveTo(endPointX - (arrowWidth * Math.sin(arrowAngle - Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle - Math.PI / 6)));

		ctx.lineTo(endPointX, endPointY);

		ctx.lineTo(endPointX - (arrowWidth * Math.sin(arrowAngle + Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle + Math.PI / 6)));

		ctx.stroke();
		ctx.closePath();
	}
	
	ButtonHilitePanel.prototype.fillCanvas = function()
	{
		HilitePanel.prototype.fillCanvas.call(this);
		
		var r = this.hiliteBoundingRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r3 = this.helpSpanNode.getBoundingClientRect();
		
		/* x0, y0 is the lower left corner of the hilitedElement */
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var y0 = r.top - r2.top + r.height / 2.0 + r1;
		var x0 = r.left - r2.left + r.width / 2.0 - r1;
		
		x0 -= 3 * this.emToPx;
		var left = Math.max(x0 - this.helpMaxWidth, this.emToPx);

		$(this.helpSpanNode).css('top', y0)
			.css('left', left)
			.css('width', x0 - left);
		this.drawArrow();
		
		left = Math.max(x0 - this.gotItWidth, this.emToPx);
		$(this.gotItNode).css('top', y0 + $(this.helpSpanNode).outerHeight() + this.emToPx)
			.css('left', left)
			.css('width', x0 - left);
	}
	
	function ButtonHilitePanel(hilitedPanel, buttonNode)
	{
		HilitePanel.apply(this, [hilitedPanel, buttonNode]);
	}
	
	return ButtonHilitePanel;
})();

var LeftButtonHilitePanel = (function()
{
	LeftButtonHilitePanel.prototype = Object.create(ButtonHilitePanel.prototype);
	LeftButtonHilitePanel.prototype.constructor = LeftButtonHilitePanel;
	
	LeftButtonHilitePanel.prototype.drawArrow = function()
	{
		var ctx = this.canvas.node().getContext('2d');

		var r = this.hiliteBoundingRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var $helpNode = $(this.helpSpanNode);
		var startPointX = parseFloat($helpNode.css('left')) - 3;
		var startPointY = parseFloat($helpNode.css('top')) + $helpNode.innerHeight() / 2;
		var pos = this.hilitePosition();
		var endPointX = pos.left + r.width;
		var endPointY = pos.top + r.height;
		var quadPointX1 = (startPointX + endPointX) / 2 + 5;
		var quadPointY1 = startPointY;
		var quadPointX2 = (startPointX + endPointX) / 2 - 5;
		var quadPointY2 = endPointY;
		var anglePointX = (quadPointX1 / 6) + (quadPointX2 / 6 * 5);
		var anglePointY = (quadPointY1 / 6) + (quadPointY2 / 6 * 5);

		ctx.strokeStyle = "rgb(255,255,255)";
		ctx.lineWidth = 2.3;

		var arrowAngle = Math.atan2(anglePointX - endPointX, anglePointY - endPointY) + Math.PI;
		var arrowWidth = 12;

		ctx.beginPath();
		ctx.moveTo(startPointX, startPointY);

		ctx.bezierCurveTo(quadPointX1, quadPointY1, quadPointX2, quadPointY2, endPointX, endPointY);

		ctx.moveTo(endPointX - (arrowWidth * Math.sin(arrowAngle - Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle - Math.PI / 6)));

		ctx.lineTo(endPointX, endPointY);

		ctx.lineTo(endPointX - (arrowWidth * Math.sin(arrowAngle + Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle + Math.PI / 6)));

		ctx.stroke();
		ctx.closePath();
	}
	
	LeftButtonHilitePanel.prototype.fillCanvas = function()
	{
		HilitePanel.prototype.fillCanvas.call(this);
		
		var r = this.hiliteBoundingRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var opacity = 0.5;
		var y0 = r.top - r2.top + r.height / 2.0;
		var x0 = r.left - r2.left + r.width / 2.0;

		var r3 = this.helpSpanNode.getBoundingClientRect();
		
		/* x0, y0 is the lower left corner of the hilitedElement */
		var y0 = r.top - r2.top + r.height;
		var x0 = r.left - r2.left ;
		
		y0 += 3 * this.emToPx;
		x0 += 3 * this.emToPx;
		var left = Math.min(r2.width - this.helpMaxWidth - this.emToPx,
							x0 + r.width);
		left = Math.max(left, x0);

		var width = Math.min(this.helpMaxWidth, r2.width - this.emToPx - left);
		$(this.helpSpanNode).css('top', y0)
			.css('left', left)
			.css('width', width);
		if (parseFloat($(this.helpSpanNode).css('left')) > r.left + r.width)
			this.drawArrow();
		
		left = Math.max(left + width - this.gotItWidth, this.emToPx);
		$(this.gotItNode).css('top', y0 + $(this.helpSpanNode).outerHeight() + this.emToPx)
			.css('left', left)
			.css('width', this.gotItWidth);
	}
	
	function LeftButtonHilitePanel(hilitedPanel, buttonNode)
	{
		ButtonHilitePanel.apply(this, [hilitedPanel, buttonNode]);
		
		$(this.helpSpanNode).addClass('hilite-help-left');
	}
	
	return LeftButtonHilitePanel;
})();

var BlockHilitePanel = (function()
{
	BlockHilitePanel.prototype = Object.create(HilitePanel.prototype);
	BlockHilitePanel.prototype.constructor = BlockHilitePanel;
	
	BlockHilitePanel.prototype.fillCanvas = function()
	{
		HilitePanel.prototype.fillCanvas.call(this);

		var r = this.hiliteBoundingRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var opacity = 0.5;
		var y0 = r.top - r2.top + r.height / 2.0;
		var x0 = r.left - r2.left + r.width / 2.0;

		var r3 = this.helpSpanNode.getBoundingClientRect();
		
		/* x0, y0 is the lower left corner of the hilitedElement */
		var y0 = r.top - r2.top + r.height;
		var x0 = r.left - r2.left ;
		
		y0 += 3 * this.emToPx;
		x0 += 3 * this.emToPx;
		var left = Math.min(r2.width - this.helpMaxWidth - this.emToPx,
							x0 + r.width);
		left = Math.max(left, x0);

		var width = Math.min(this.helpMaxWidth, r2.width - this.emToPx - left);
		$(this.helpSpanNode).css('top', y0)
			.css('left', left)
			.css('width', width);
		
		left = Math.max(left + width - this.gotItWidth, this.emToPx);
		$(this.gotItNode).css('top', y0 + $(this.helpSpanNode).outerHeight() + this.emToPx)
			.css('left', left)
			.css('width', this.gotItWidth);
	}
	
	function BlockHilitePanel(hilitedPanel, buttonNode)
	{
		HilitePanel.apply(this, [hilitedPanel, buttonNode]);
	}
	
	return BlockHilitePanel;
})();

var AddExperienceHilitePanel = (function()
{
	AddExperienceHilitePanel.prototype = Object.create(ButtonHilitePanel.prototype);
	AddExperienceHilitePanel.prototype.constructor = AddExperienceHilitePanel;
	
	AddExperienceHilitePanel.prototype.helpText = "Add goals and experiences to your path";
	AddExperienceHilitePanel.prototype.tipLevel = 2;
	
	AddExperienceHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new SearchButtonHilitePanel(this.hilitedPanel);
	}
	
	function AddExperienceHilitePanel(pathPanel)
	{
		ButtonHilitePanel.apply(this, [pathPanel, $(pathPanel.addExperienceButton.node()).children('img').get(0)]);
	}
	
	return AddExperienceHilitePanel;
})();

var SearchButtonHilitePanel = (function()
{
	SearchButtonHilitePanel.prototype = Object.create(ButtonHilitePanel.prototype);
	SearchButtonHilitePanel.prototype.constructor = SearchButtonHilitePanel;
	
	SearchButtonHilitePanel.prototype.helpText = "Search for other paths and goals like yours";
	SearchButtonHilitePanel.prototype.tipLevel = 3;
	
	SearchButtonHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new SettingsButtonHilitePanel(this.hilitedPanel);
	}
	
	function SearchButtonHilitePanel(pathPanel)
	{
		ButtonHilitePanel.apply(this, [pathPanel, $(pathPanel.searchButton.node()).children('img').get(0)]);
	}
	
	return SearchButtonHilitePanel;
})();

var SettingsButtonHilitePanel = (function()
{
	SettingsButtonHilitePanel.prototype = Object.create(LeftButtonHilitePanel.prototype);
	SettingsButtonHilitePanel.prototype.constructor = SettingsButtonHilitePanel;
	
	SettingsButtonHilitePanel.prototype.helpText = "Share your profile and path with friends";
	SettingsButtonHilitePanel.prototype.tipLevel = 4;
	
	SettingsButtonHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new NotificationsButtonHilitePanel(this.hilitedPanel);
	}
	
	function SettingsButtonHilitePanel(pathPanel)
	{
		LeftButtonHilitePanel.apply(this, [pathPanel, $(pathPanel.settingsAlertButton.node()).children('img').get(0)]);
	}
	
	return SettingsButtonHilitePanel;
})();

var NotificationsButtonHilitePanel = (function()
{
	NotificationsButtonHilitePanel.prototype = Object.create(LeftButtonHilitePanel.prototype);
	NotificationsButtonHilitePanel.prototype.constructor = NotificationsButtonHilitePanel;
	
	NotificationsButtonHilitePanel.prototype.helpText = "Answer questions others have about your path";
	NotificationsButtonHilitePanel.prototype.tipLevel = 5;
	NotificationsButtonHilitePanel.prototype.gotIt = "Let's Get Started!";
	
	function NotificationsButtonHilitePanel(pathPanel)
	{
		LeftButtonHilitePanel.apply(this, [pathPanel, $(pathPanel.notificationsAlertButton.node()).children('img').get(0)]);
	}
	
	return NotificationsButtonHilitePanel;
})();

var PathHeadersHilitePanel = (function()
{
	PathHeadersHilitePanel.prototype = Object.create(HilitePanel.prototype);
	PathHeadersHilitePanel.prototype.constructor = PathHeadersHilitePanel;
	
	PathHeadersHilitePanel.prototype.helpText = "Experiences on your path are organized into these categories";
	PathHeadersHilitePanel.prototype.tipLevel = 1;
	
	PathHeadersHilitePanel.prototype.hiliteBoundingRect = function()
	{
		var r = this.hilitedElement.getBoundingClientRect();
		r.height = this.hilitedPanel.pathtree.experienceGroup.node().getBoundingClientRect().top - r.top;
		return r;
	}
	
	PathHeadersHilitePanel.prototype.hilitePosition = function()
	{
		var p = $(this.hilitedElement).position();
		p.top += this.hilitedPanel.pathtree.svg.node().getBoundingClientRect().top;
		return p;
	}
	
	PathHeadersHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		if (!this.hilitedPanel.hasSidebar())
			new AddExperienceHilitePanel(this.hilitedPanel);
		else
			new SearchButtonHilitePanel(this.hilitedPanel);
	}
	
	PathHeadersHilitePanel.prototype.drawArrow = function()
	{
		var ctx = this.canvas.node().getContext('2d');

		var r = this.hiliteBoundingRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var $helpNode = $(this.helpSpanNode);
		var startPointX = parseFloat($helpNode.css('left')) - 3;
		var startPointY = parseFloat($helpNode.css('top')) + $helpNode.innerHeight() / 2;
		var pos = this.hilitePosition();
		var endPointX = pos.left + r.width;
		var endPointY = pos.top + r.height;
		var quadPointX1 = (startPointX + endPointX) / 2 + 5;
		var quadPointY1 = startPointY;
		var quadPointX2 = (startPointX + endPointX) / 2 - 5;
		var quadPointY2 = endPointY;
		var anglePointX = (quadPointX1 / 6) + (quadPointX2 / 6 * 5);
		var anglePointY = (quadPointY1 / 6) + (quadPointY2 / 6 * 5);

		ctx.strokeStyle = "rgb(255,255,255)";
		ctx.lineWidth = 2.3;

		var arrowAngle = Math.atan2(anglePointX - endPointX, anglePointY - endPointY) + Math.PI;
		var arrowWidth = 12;

		ctx.beginPath();
		ctx.moveTo(startPointX, startPointY);

		ctx.bezierCurveTo(quadPointX1, quadPointY1, quadPointX2, quadPointY2, endPointX, endPointY);

		ctx.moveTo(endPointX - (arrowWidth * Math.sin(arrowAngle - Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle - Math.PI / 6)));

		ctx.lineTo(endPointX, endPointY);

		ctx.lineTo(endPointX - (arrowWidth * Math.sin(arrowAngle + Math.PI / 6)), 
				   endPointY - (arrowWidth * Math.cos(arrowAngle + Math.PI / 6)));

		ctx.stroke();
		ctx.closePath();
	}
	
	PathHeadersHilitePanel.prototype.fillCanvas = function()
	{
		HilitePanel.prototype.fillCanvas.call(this);

		var r = this.hiliteBoundingRect();
		var r2 = this.panelNode.getBoundingClientRect();
		var r1 = Math.max(r.width, r.height) / 2.0 * 1.5;
		var opacity = 0.5;
		var y0 = r.top - r2.top + r.height / 2.0;
		var x0 = r.left - r2.left + r.width / 2.0;

		var r3 = this.helpSpanNode.getBoundingClientRect();
		
		/* x0, y0 is the lower left corner of the hilitedElement */
		var y0 = r.top - r2.top + r.height;
		var x0 = r.left - r2.left ;
		
		y0 += 3 * this.emToPx;
		x0 += 3 * this.emToPx;
		var left = Math.min(r2.width - this.helpMaxWidth - this.emToPx,
							x0 + r.width);
		left = Math.max(left, x0);

		var width = Math.min(this.helpMaxWidth, r2.width - this.emToPx - left);
		$(this.helpSpanNode).css('top', y0)
			.css('left', left)
			.css('width', width);
		if (parseFloat($(this.helpSpanNode).css('left')) > r.left + r.width)
			this.drawArrow();
		
		left = Math.max(left + width - this.gotItWidth, this.emToPx);
		$(this.gotItNode).css('top', y0 + $(this.helpSpanNode).outerHeight() + this.emToPx)
			.css('left', left)
			.css('width', this.gotItWidth);
	}
	
	function PathHeadersHilitePanel(pathPanel)
	{
		HilitePanel.apply(this, [pathPanel, pathPanel.pathtree.guideGroup.node()]);
	}
	
	return PathHeadersHilitePanel;
})();

var TagsHilitePanel = (function()
{
	TagsHilitePanel.prototype = Object.create(BlockHilitePanel.prototype);
	TagsHilitePanel.prototype.constructor = TagsHilitePanel;
	
	TagsHilitePanel.prototype.helpText = "Tags show what kind of experience this is and help others find this kind of experience";
	TagsHilitePanel.prototype.tipLevel = 8;
	TagsHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	TagsHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new TimeframesHilitePanel(this.hilitedPanel);
	}
	
	function TagsHilitePanel(newExperiencePanel)
	{
		BlockHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.tagPoolSection.tagsContainer.node()]);
	}
	
	return TagsHilitePanel;
})();

var TimeframesHilitePanel = (function()
{
	TimeframesHilitePanel.prototype = Object.create(BlockHilitePanel.prototype);
	TimeframesHilitePanel.prototype.constructor = TimeframesHilitePanel;
	
	TimeframesHilitePanel.prototype.helpText = "You can set the timeframe for an experience even if you don't know the start or end dates";
	TimeframesHilitePanel.prototype.tipLevel = 16;
	TimeframesHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	TimeframesHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new OrganizationHilitePanel(this.hilitedPanel);
	}
	
	function TimeframesHilitePanel(newExperiencePanel)
	{
		BlockHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.optionPanel.node()]);
	}
	
	return TimeframesHilitePanel;
})();

var OrganizationHilitePanel = (function()
{
	OrganizationHilitePanel.prototype = Object.create(BlockHilitePanel.prototype);
	OrganizationHilitePanel.prototype.constructor = OrganizationHilitePanel;
	
	OrganizationHilitePanel.prototype.helpText = "Fill in the name of the organization that provided this experience, such as the employer who gave you a job or the organization that offered a class you took";
	OrganizationHilitePanel.prototype.tipLevel = 8 + 16;
	OrganizationHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	OrganizationHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new OfferingHilitePanel(this.hilitedPanel);
	}
	
	function OrganizationHilitePanel(newExperiencePanel)
	{
		BlockHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.organizationInput.node()]);
	}
	
	return OrganizationHilitePanel;
})();

var OfferingHilitePanel = (function()
{
	OfferingHilitePanel.prototype = Object.create(BlockHilitePanel.prototype);
	OfferingHilitePanel.prototype.constructor = OfferingHilitePanel;
	
	OfferingHilitePanel.prototype.helpText = "Fill in the name of this experience. Examples: the name of a class you've taken or your title on a job";
	OfferingHilitePanel.prototype.tipLevel = 32;
	OfferingHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	OfferingHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new HiddenToggleHilitePanel(this.hilitedPanel);
	}
	
	function OfferingHilitePanel(newExperiencePanel)
	{
		BlockHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.offeringInput.node()]);
	}
	
	return OfferingHilitePanel;
})();
var HiddenToggleHilitePanel = (function()
{
	HiddenToggleHilitePanel.prototype = Object.create(BlockHilitePanel.prototype);
	HiddenToggleHilitePanel.prototype.constructor = AddButtonHilitePanel;
	
	HiddenToggleHilitePanel.prototype.helpText = "Hide this experience from those who can see your path";
	HiddenToggleHilitePanel.prototype.tipLevel = 8 + 32;
	HiddenToggleHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	HiddenToggleHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onTipLevelUpdated.call(this);
		new AddButtonHilitePanel(this.hilitedPanel);
	}
	
	function HiddenToggleHilitePanel(newExperiencePanel)
	{
		BlockHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.isHiddenSection.node()]);
	}
	
	return HiddenToggleHilitePanel;
})();
var AddButtonHilitePanel = (function()
{
	AddButtonHilitePanel.prototype = Object.create(ButtonHilitePanel.prototype);
	AddButtonHilitePanel.prototype.constructor = AddButtonHilitePanel;
	
	AddButtonHilitePanel.prototype.helpText = "Add this experience to your path";
	AddButtonHilitePanel.prototype.tipLevel = 16 + 32;
	AddButtonHilitePanel.prototype.tipLevelMask = 8 + 16 + 32;
	
	function AddButtonHilitePanel(newExperiencePanel)
	{
		ButtonHilitePanel.apply(this, [newExperiencePanel, newExperiencePanel.doneButton.node()]);
	}
	
	return AddButtonHilitePanel;
})();
