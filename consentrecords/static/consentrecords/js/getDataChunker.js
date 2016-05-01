
/* Used to chunk getData operations. */
var GetDataChunker = (function() {
	GetDataChunker.prototype.path = null;
	GetDataChunker.prototype.fields = [];
	GetDataChunker.prototype._increment = 20;
	GetDataChunker.prototype._containerNode = null;
	GetDataChunker.prototype._loadingMessage = null;
	GetDataChunker.prototype._isSpinning = null;
	GetDataChunker.prototype._start = 0;
	GetDataChunker.prototype._inGetData = false;
	GetDataChunker.prototype._onFoundInstances = null;
	GetDataChunker.prototype._onDoneSearch = null;
	GetDataChunker.prototype._check = null;
	
	GetDataChunker.prototype._clearScrollCheck = function()
	{
		if (this._check != null)
		{
			$(this._containerNode.offsetParent).off("scroll", this._check);
			$(window).off("resize", this._check);
			this._check = null;
		}
		this._inGetData = false;
	}
	
	GetDataChunker.prototype.clearLoadingMessage = function()
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._loadingMessage.remove();
			this._loadingMessage = null;
			this._isSpinning = false;
		}
		this._clearScrollCheck();
		this._start = 0;
	}
	
	GetDataChunker.prototype._restart = function(instances, startVal)
	{
		if (!this._loadingMessage)
			throw "loadingMessage is not set up";
			
		if (instances.length < this._increment)
		{
			this.clearLoadingMessage();
			if (this._onDoneSearch)
				this._onDoneSearch();
		}
		else
		{
			this._start += this._increment;
			if (!this.isOverflowingY(this._loadingMessage.node()))
				this._continue(startVal);
			else
				this._inGetData = false;
		}
	}
	
	GetDataChunker.prototype.showLoadingMessage = function()
	{
		if (this._loadingMessage == null)
		{
			this._loadingMessage = crv.appendLoadingMessage(this._containerNode);
			this._isSpinning = true;
		}
		else if (!this._isSpinning)
		{
			crv.startLoadingMessage(this._loadingMessage);
			this._isSpinning = true;
		}
	}
	
	GetDataChunker.prototype._dataGetter = function()
	{
		return cr.getData;
	}
	
	GetDataChunker.prototype._continue = function(startVal)
	{
		var _this = this;
		if (!this.path)
			throw ("path is not specified to GetDataChunker._continue");
		
		this.showLoadingMessage();

		this._dataGetter()({path: this.path, 
					start: this._start,
					end: this._start + this._increment,
					fields: this.fields, 
					done: function(instances) 
						{ 
							/* this.inGetData is set to false if the scrollCheck is cleared, which occurs when
								this is destroyed. If it is destroyed, there may be an asynchronous call hanging out,
								which is handled here.
							 */
							if (_this._inGetData)
							{
								if (_this._onFoundInstances(instances, startVal))
									_this._restart(instances, startVal);
							}
						}, 
					fail: asyncFailFunction});
		this._inGetData = true;
	}
	
	GetDataChunker.prototype._setScrollCheck = function(startVal)
	{
		var _this = this;
		
		this._clearScrollCheck();
		this._start = 0;

		this._check = function(eventObject)
		{
			_this._onScroll(eventObject.data);
		}
		
		var scrollingNode = this._containerNode.offsetParent;
		
		if (!scrollingNode)
			throw "offsetParent not specified; containerNode is not displayed"
			
		$(scrollingNode).scroll(startVal, this._check);
		$(scrollingNode).on("resize.cr", this._check);
	}
	
	GetDataChunker.prototype.checkStart = function(startVal)
	{
		if (!this.path)
			return;
			
		this._setScrollCheck(startVal);
		this.showLoadingMessage();
		this._onScroll(startVal);
	}
	
	GetDataChunker.prototype.start = function(startVal)
	{
		this._setScrollCheck(startVal);
		this._continue(startVal);
	}
	
	GetDataChunker.prototype.isOverflowingY = function(node)
	{
		var p = node.offsetParent;
		return node.offsetTop > $(p).scrollTop() + $(p).height();
	}
	
	GetDataChunker.prototype._onScroll = function(startVal)
	{
		if (this._loadingMessage != null && !this._inGetData)
		{
			if (!this.isOverflowingY(this._loadingMessage.node()))
				this._continue(startVal);
		}
	}
	
	GetDataChunker.prototype._appendNode = function(elementType)
	{
		var t = document.createElement(elementType);
		if (this._loadingMessage)
    		this._containerNode.insertBefore(t, this._loadingMessage.node());
    	else
    		this._containerNode.appendChild(t);
    	return t;
	}

	GetDataChunker.prototype.appendButtonContainers = function(data)
	{
		var _this = this;
		
		/* Ensure that the container is visible, so that the new items will also appear. */
		$(this._containerNode).css("display", "");
		
		var items = data.map(function(d) {
			var i = _this._appendNode('li');
			d3.select(i).datum(d);
			return i;
		});
		return d3.selectAll(items);
	}
	
	GetDataChunker.prototype.hasShortResults = function()
	{
		return d3.select(this._containerNode).selectAll('li').size() < this._increment &&
			   !this._inGetData;
	}
	
	GetDataChunker.prototype.hasButtons = function()
	{
		return d3.select(this._containerNode).selectAll('li').size() > 0;
	}
	
	GetDataChunker.prototype.buttons = function()
	{
		return d3.select(this._containerNode).selectAll('li');
	}
	
	function GetDataChunker(containerNode, onFoundInstances, onDoneSearch)
	{
		this._containerNode = containerNode;
		this._loadingMessage = null;
		this._isSpinning = false;
		this.path = null;
		this._start = 0;
		this._inGetData = false;
		this._onFoundInstances = onFoundInstances;
		this._onDoneSearch = onDoneSearch;
		this._check = null;
		
		var _this = this;
		$(this._containerNode).on("remove", function()
			{
				_this._inGetData = false;
			});
	}
	
	return GetDataChunker;
})();

var SelectAllChunker = (function() {
	SelectAllChunker.prototype = new GetDataChunker();

	SelectAllChunker.prototype._dataGetter = function()
	{
		return cr.selectAll;
	}
	function SelectAllChunker(containerNode, onGetDataDone)
	{
		GetDataChunker.call(this, containerNode, onGetDataDone);
	}
	return SelectAllChunker;
})();
