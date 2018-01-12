var HilitePanel = (function () {
	HilitePanel.prototype = Object.create(EditPanel.prototype);
	HilitePanel.prototype.constructor = HilitePanel;
	
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
	
	HilitePanel.prototype.onCompleteClick = function()
	{
		var _this = this;
		return this.hide()
			.then(function()
				{
					$(this.panelNode).off('resize.cr', this.fillCanvasFunction);
				},
				cr.chainFail);
	}
	
	HilitePanel.prototype.onClose = function()
	{
		if (prepareClick('click', 'Close HilitePanel'))
		{
			this.onCompleteClick()
				.then(unblockClick, cr.syncFail);
		}
	}
	
	function HilitePanel(pathPanel, panelNode, hilitedElement) {
			
		var _this = this;
		
		this.panelNode = panelNode;
		this.hilitedElement = hilitedElement;
		
		this.fillCanvasFunction = function() { _this.fillCanvas(); };

		this.panel = d3.select(panelNode).append('panel')
			.classed('hilite', true)
			.style('top', 0)
			.style('opacity', 0)
			.on('click', function()
				{
					_this.onClose();
				});
		
		this.pathPanel = pathPanel;
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

		this.canvas = d3.select(panelNode)
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
	}
	
	return HilitePanel;
})();

var ButtonHilitePanel = (function()
{
	ButtonHilitePanel.prototype = Object.create(HilitePanel.prototype);
	ButtonHilitePanel.prototype.constructor = ButtonHilitePanel;
	
	ButtonHilitePanel.prototype.gotIt = "Continue";
	
	ButtonHilitePanel.prototype.onTipLevelUpdated = function()
	{
		HilitePanel.prototype.onCompleteClick.call(this);
	}
	
	ButtonHilitePanel.prototype.onCompleteClick = function()
	{
		var _this = this;
		
		return cr.signedinUser.update({'tip level': this.tipLevel})
			.then(function()
				{
					_this.onTipLevelUpdated();
				},
				cr.syncFail);
	}
	
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
	
	function ButtonHilitePanel(pathPanel, buttonNode)
	{
		HilitePanel.apply(this, [pathPanel, pathPanel.node(), $(buttonNode).children('img').get(0)]);
		
		var _this = this;
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
	
	function LeftButtonHilitePanel(pathPanel, buttonNode)
	{
		HilitePanel.apply(this, [pathPanel, pathPanel.node(), $(buttonNode).children('img').get(0)]);
		
		var _this = this;
		this.helpSpanNode = d3.select(this.panelNode).append('span')
			.classed('hilite-help hilite-help-left', true)
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
	
	return LeftButtonHilitePanel;
})();

var AddExperienceHilitePanel = (function()
{
	AddExperienceHilitePanel.prototype = Object.create(ButtonHilitePanel.prototype);
	AddExperienceHilitePanel.prototype.constructor = AddExperienceHilitePanel;
	
	AddExperienceHilitePanel.prototype.helpText = "Add goals and experiences to your path";
	AddExperienceHilitePanel.prototype.tipLevel = 2;
	
	AddExperienceHilitePanel.prototype.onTipLevelUpdated = function()
	{
		ButtonHilitePanel.prototype.onTipLevelUpdated.call(this);
		new SearchButtonHilitePanel(this.pathPanel);
	}
	
	function AddExperienceHilitePanel(pathPanel)
	{
		ButtonHilitePanel.apply(this, [pathPanel, pathPanel.addExperienceButton.node()]);
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
		ButtonHilitePanel.prototype.onTipLevelUpdated.call(this);
		new SettingsButtonHilitePanel(this.pathPanel);
	}
	
	function SearchButtonHilitePanel(pathPanel)
	{
		ButtonHilitePanel.apply(this, [pathPanel, pathPanel.searchButton.node()]);
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
		ButtonHilitePanel.prototype.onTipLevelUpdated.call(this);
		new NotificationsButtonHilitePanel(this.pathPanel);
	}
	
	function SettingsButtonHilitePanel(pathPanel)
	{
		LeftButtonHilitePanel.apply(this, [pathPanel, pathPanel.settingsAlertButton.node()]);
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
		LeftButtonHilitePanel.apply(this, [pathPanel, pathPanel.notificationsAlertButton.node()]);
	}
	
	return NotificationsButtonHilitePanel;
})();

var PathHeadersHilitePanel = (function()
{
	PathHeadersHilitePanel.prototype = Object.create(HilitePanel.prototype);
	PathHeadersHilitePanel.prototype.constructor = PathHeadersHilitePanel;
	
	PathHeadersHilitePanel.prototype.helpText = "Experiences on your path are organized into these categories";
	PathHeadersHilitePanel.prototype.gotIt = "Continue";
	
	PathHeadersHilitePanel.prototype.hiliteBoundingRect = function()
	{
		var r = this.hilitedElement.getBoundingClientRect();
		r.height = this.pathPanel.pathtree.experienceGroup.node().getBoundingClientRect().top - r.top;
		return r;
	}
	
	PathHeadersHilitePanel.prototype.hilitePosition = function()
	{
		var p = $(this.hilitedElement).position();
		p.top += this.pathPanel.pathtree.svg.node().getBoundingClientRect().top;
		return p;
	}
	
	PathHeadersHilitePanel.prototype.onCompleteClick = function()
	{
		var _this = this;
		
		return cr.signedinUser.update({'tip level': 1})
			.then(function()
				{
					HilitePanel.prototype.onCompleteClick.call(_this);
					if (!_this.pathPanel.hasSidebar())
						new AddExperienceHilitePanel(_this.pathPanel);
					else
						new SearchButtonHilitePanel(_this.pathPanel);
				},
				cr.syncFail);
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
		HilitePanel.apply(this, [pathPanel, pathPanel.node(), pathPanel.pathtree.guideGroup.node()]);
		
		var _this = this;
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
	
	return PathHeadersHilitePanel;
})();

