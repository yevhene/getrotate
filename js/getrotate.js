var GetRotate = GetRotate || {};

GetRotate.Utils = GetRotate.Utils || (function() {
  var resizeContent = function(container, content, originalContentSize) {
    var containerWidth = container.clientWidth; // Max width for image
    var containerHeight = container.clientHeight; // Max height for the image
    var containerAspectRatio = containerWidth / containerHeight;
    var contentAspectRatio = originalContentSize.width / originalContentSize.height;

    var width = 0;
    var height = 0;
    var marginLeft = 0;
    var marginTop = 0;

    if (containerAspectRatio > contentAspectRatio) {
      // Container wider than content.
      height = containerHeight;
      width = originalContentSize.width * (containerHeight / originalContentSize.height);
      // Place in middle of container. (Optional)
      marginLeft = (containerWidth - width) / 2;
    } else {
      // Container higher than content.
      width = containerWidth;
      height = originalContentSize.height * (containerWidth / originalContentSize.width);
      // Place in middle of _content. (Optional)
      marginTop = (containerHeight - height) / 2;
    }
    content.style.width = width + 'px';
    content.style.height = height + 'px';
  };

  var mapIntoRange = function(min, max, n) {
    if (n >= min && n <= max) {
      return n;
    }
    if (n > max) {
      return min + (n - min) % (max - min + 1);
    }
    if (n < min) {
      return max - Math.abs(n - min + 1) % (max - min + 1);
    }
    return min;
  };

  var fixEvent = function(e, _this) {
    e = e || window.event;

    if (!e.currentTarget) {
      e.currentTarget = _this;
    }
    if (!e.target) {
      e.target = e.srcElement;
    }

    if (!e.relatedTarget) {
      if (e.type === 'mouseover') {
        e.relatedTarget = e.fromElement;
      }
      if (e.type === 'mouseout') {
        e.relatedTarget = e.toElement;
      }
    }

    if (e.pageX === undefined && e.clientX !== null ) {
      var html = document.documentElement;
      var body = document.body;

      e.pageX = e.clientX + ((html.scrollLeft || body) && (body.scrollLeft || 0));
      e.pageX -= html.clientLeft || 0;

      e.pageY = e.clientY + ((html.scrollTop || body) && (body.scrollTop || 0));
      e.pageY -= html.clientTop || 0;
    }

    if (!e.which && e.button) {
      e.which = e.button & 1 ? 1 : ( e.button & 2 ? 3 : (e.button & 4 ? 2 : 0) );
    }

    return e;
  };

  var addEventListener = function(object, event, handler) {
    var result;
    if (object.addEventListener) {
      result = object.addEventListener(event, handler);
    } else {
      if (object.attachEvent) {
        result = object.attachEvent('on' + event, handler);
      }
    }
    return result;
  };

  var asyncLoop = function(func, done) {
    var index = -1;
    var isDone = false;
    var loop = {
      next: function() {
        if (isDone) {
          return;
        }
        index++;
        func(loop);
      },
      index: function() {
        return index;
      },
      stop: function() {
        isDone = true;
        done();
      }
    };
    loop.next();
    return loop;
  };

  var fill = function(to, from) {
    if (!from) {
      return to;
    }
    var key;
    for (key in from) { if (from.hasOwnProperty(key)) {
      to[key] = from[key];
    }}
    return to;
  };

  var imageSize = function(src, callback) {
    var img = new Image();
    img.onload = function() {
      callback({ width: this.width, height: this.height });
    };
    img.src = src;
  };

  return {
    resizeContent: resizeContent,
    mapIntoRange: mapIntoRange,
    fixEvent: fixEvent,
    addEventListener: addEventListener,
    asyncLoop: asyncLoop,
    fill: fill,
    imageSize: imageSize
  };
}());

GetRotate.Player = GetRotate.Player || function(options) {
  // Defaults
  var settings = GetRotate.Utils.fill({
    speed: 600, // Number of pixels in single full turnover
    maxInertiaVelocity: 1.5, // px/ms
    inertiaVelocityThreshold: 0.1, // px/ms
    inertiaTime: 1500, // ms
    reversedOrder: false,
    onReady: function() { /* EMPTY */ }
  }, options);

  // Var
  var _root;
    var _player;
      var _content;
        var _eventOverlay;
        var _product;
      var _progressBar;
        var _progress;

  // Subsystems
  var _loader;
  var _manipulator;

  var _model;

  var _currentPhotoIndex = 0;
  var _currentPhotos;

  var _mode = 'main';

  var _isEventsBlocked = false;

  var _blockEvents = function() {
    _isEventsBlocked = true;
  };

  var _unblockEvents = function() {
    _isEventsBlocked = false;
  };

  var _fixProductSize = function() {
    GetRotate.Utils.resizeContent(
      _content, _product, _model[_mode].size
    );
  };

  var _update = function() {
    var i = 0;
    var photoCount = _currentPhotos.length;
    for (i = 0; i < photoCount; ++i) {
      if (i === _currentPhotoIndex) {
        _product.children[i].style.display = 'block';
      } else {
        _product.children[i].style.display = 'none';
      }
    }
  };

  var Loader = function() {
    var isLoading = false;
    var cancelLoading = false;

    var showProgressBar = function() {
      _progress.style.width = 0;
      _progressBar.style.display = 'block';
    };

    var hideProgressBar = function() {
      _progressBar.style.display = 'none';
    };

    var updateProgressBar = function(number, max) {
      _progress.style.width = ((number / max) * 100) + '%';
    };

    var that = this;

    this.clear = function() {
      while (_product.hasChildNodes()) {
        _product.removeChild(_product.lastChild);
      }
    };

    this.build = function() {
      _blockEvents();
      var length = _currentPhotos.length;
      GetRotate.Utils.asyncLoop(function iteration(loop) {
        if (loop.index() >= _currentPhotos.length || cancelLoading) {
          loop.stop();
          return;
        }
        var img = document.createElement('img');
        if (!_model[_mode].isLoaded) {
          img.style.display = 'none';
          img.onload = function() {
            setTimeout(function() {
              if (loop.index() === 0) {
                img.style.display = 'block';
              }
              updateProgressBar(loop.index() + 1, _currentPhotos.length);
              loop.next();
            }, 10);
          };
        }
        if (settings.reversedOrder) {
          img.setAttribute('src', _currentPhotos[length - 1 - loop.index()]);
        } else {
          img.setAttribute('src', _currentPhotos[loop.index()]);
        }
        _product.appendChild(img);
        if (_model[_mode].isLoaded) {
          updateProgressBar(loop.index() + 1, _currentPhotos.length);
          loop.next();
        }
      }, function done() {
        isLoading = false;
        if (cancelLoading) {
          cancelLoading = false;
          that.load();
        } else {
          _model[_mode].isLoaded = true;
          _update();
          _unblockEvents();
        }
        hideProgressBar();

        settings.onReady();
      });
    };

    this.load = function() {
      if (isLoading) {
        cancelLoading = true;
        return;
      }
      showProgressBar();
      _manipulator.stopInertia();
      isLoading = true;
      if (typeof _model.main.photo === 'string') {
        _currentPhotos = [_model[_mode].photo];
      } else {
        _currentPhotos = _model[_mode].photo;
      }
      var photoCount = _currentPhotos.length;

      this.clear();

      GetRotate.Utils.imageSize(_currentPhotos[0], function(size) {
        _model[_mode].size = size;
        _fixProductSize();
        that.build();
      });
    };
  };
  _loader = new Loader();

  var Manipulator = function() {
    this.isDragging = false;

    var dragLastX = 0;

    var dragStartScreenX = 0;
    var dragStartPhotoIndex = 0;

    var currentDirectionDragStartScreenX = 0;
    var currentDirectionDragStartTime = 0;
    var currentDirection = 0;

    var ondragstart_old = null;
    var onselectstart_old = null;
    var oncontextmenu_old = null;

    var isInertiaRotating = false;
    var stopInertia = false;

    this.move = function(x) {
      var delta = x - dragStartScreenX;
      var photoCount = _currentPhotos.length;
      var threshold = settings.speed / photoCount;
      var relativeIndex = Math.floor((delta % settings.speed) / threshold);
      var index = GetRotate.Utils.mapIntoRange(
        0, photoCount - 1, relativeIndex + dragStartPhotoIndex
      );
      if (index !== _currentPhotoIndex) {
        _currentPhotoIndex = index;
        _update();
      }
    };

    this.stopInertia = function() {
      if (isInertiaRotating) {
        stopInertia = true;
      }
    };

    this._startInertia = function(currentScreenX) {
      isInertiaRotating = true;
      var calulateStartVelocity = function() {
        var time = new Date().getTime() - currentDirectionDragStartTime;
        var distance = Math.abs(currentScreenX - currentDirectionDragStartScreenX);
        var velocity = distance / time;
        if (velocity > settings.maxInertiaVelocity) {
          velocity = settings.maxInertiaVelocity;
        }
        return velocity;
      };
      var startVelocity = calulateStartVelocity();
      if (startVelocity < settings.inertiaVelocityThreshold) {
        return;
      }
      var screenX = currentScreenX;
      var startTime = new Date().getTime();
      var currentTime = 0;
      var calculateCurrentVelocity = function(currentTime) {
        return startVelocity * ((settings.inertiaTime - currentTime) / settings.inertiaTime);
      };

      var that = this;
      var timer = setInterval(function rotate() {
        if (stopInertia) {
          isInertiaRotating = false;
          stopInertia = false;
          clearInterval(timer);
          return;
        }
        var oldTime = currentTime;
        currentTime = new Date().getTime() - startTime;
        var dTime = currentTime - oldTime;
        var currentVelocity = calculateCurrentVelocity(currentTime);
        if (currentVelocity < settings.inertiaVelocityThreshold) {
          isInertiaRotating = false;
          clearInterval(timer);
          return;
        }
        screenX += currentVelocity * dTime * currentDirection;
        that.move(screenX);
      }, 50);
    };

    this._startDragging = function() {
      if (this.isDragging) {
        return;
      }
      this.isDragging = true;
      document.body.style.cursor = 'move';
      ondragstart_old = document.ondragstart;
      onselectstart_old = document.onselectstart;
      oncontextmenu_old = document.oncontextmenu;
      document.onselectstart = function() {
        return false;
      };
      document.onselectstart = function() {
        return false;
      };
      document.oncontextmenu = function() {
        return false;
      };
      this.stopInertia();
    };

    this._stopDragging = function(x) {
       if (!this.isDragging) {
        return;
      }
      this.isDragging = false;
      document.body.style.cursor = 'default';
      document.ondragstart = ondragstart_old;
      document.onselectstart = onselectstart_old;
      document.oncontextmenu = oncontextmenu_old;
      this._startInertia(x);
    };

    this.end = function(x) {
      if (this.isDragging) {
        this._stopDragging(x);
        document.body.style.cursor = 'default';
      }
    };

    this.cancel = function(x) {
      if (this.isDragging) {
        this._stopDragging(x);
        document.body.style.cursor = 'default';
      }
    };

    this.start = function(x) {
      if (_isEventsBlocked) {
        return;
      }
      this._startDragging();

      dragLastX = x;

      dragStartScreenX = x;
      dragStartPhotoIndex = _currentPhotoIndex;

      currentDirectionDragStartScreenX = dragStartScreenX;
      currentDirectionDragStartTime = new Date().getTime();
      currentDirection = 0;
    };

    this.drag = function(x) {
      if (this.isDragging) {
        this.move(x);

        var d = x - dragLastX;
        var direction = d / Math.abs(d);
        if (currentDirection === 0) {
          currentDirection = direction;
        } else if (direction !== currentDirection) {
          currentDirectionDragStartScreenX = x;
          currentDirectionDragStartTime = new Date().getTime();
          currentDirection = direction;
        }

        dragLastX = x;
      }
      return !this.isDragging;
    };
  };
  _manipulator = new Manipulator();

  var _old_body_overflow_value = null;
  var _toggleFullscreen = function() {
    _mode = _mode === 'main' ? 'fullscreen' : 'main';

    if (_mode === 'fullscreen') {
      // Hide scroll.
      _old_body_overflow_value = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Add fullscreen style.
      _player.setAttribute('class', 'grplayer-player grplayer-fullscreen');
    } else {
      // Recover scroll state.
      document.body.style.overflow = _old_body_overflow_value;
      // Remove fullscreen style.
      _player.setAttribute('class', 'grplayer-player');
    }

    _loader.load();
  };

  function _attachMouseEvents() {
    _player.ondragstart = function() {
      return false;
    };
    _player.onselectstart = function() {
      return false;
    };
    _player.oncontextmenu = function() {
      return false;
    };

    // Attach events. Support for IE10 and iOS
    if (window.hasOwnProperty && window.hasOwnProperty('ontouchstart')) {
      GetRotate.Utils.addEventListener(_eventOverlay, 'touchstart', function(e) {
        var touch = e.touches[0];
        if (touch) {
          _manipulator.start(touch.pageX);
        }
        return false;
      });

      GetRotate.Utils.addEventListener(document, 'touchend', function(e) {
        var touch = e.touches[0];
        if (touch) {
          _manipulator.end(touch.pageX);
        }
      });

      GetRotate.Utils.addEventListener(document, 'touchmove', function(e) {
        var touch = e.touches[0];
        if (touch) {
          _manipulator.drag(touch.pageX);
        }
        return !_manipulator.isDragging;
      });
    } else if (window.navigator.msPointerEnabled) {
      GetRotate.Utils.addEventListener(_eventOverlay, 'MSPointerDown', function(e) {
        _manipulator.start(e.pageX);
        return false;
      });

      GetRotate.Utils.addEventListener(document, 'MSPointerUp', function(e) {
        _manipulator.end(e.pageX);
      });

      GetRotate.Utils.addEventListener(document, 'MSPointerMove', function(e) {
        _manipulator.drag(e.pageX);
        return !_manipulator.isDragging;
      });
    } else {
      GetRotate.Utils.addEventListener(_eventOverlay, 'mousedown', function(e) {
        e = GetRotate.Utils.fixEvent(e, _eventOverlay);
        _manipulator.start(e.pageX);
        return false;
      });

      GetRotate.Utils.addEventListener(document, 'mouseup', function(e) {
        e = GetRotate.Utils.fixEvent(e, document);
        _manipulator.end(e.pageX);
      });

      GetRotate.Utils.addEventListener(document, 'mousemove', function(e) {
        e = GetRotate.Utils.fixEvent(e, document);
        _manipulator.drag(e.pageX);
        return !_manipulator.isDragging;
      });
    }
  }

  var _init = function() {
    _player = document.createElement('div');
    _player.setAttribute('class', 'grplayer-player');
      _progressBar = document.createElement('div');
      _progressBar.setAttribute('class', 'grplayer-progress_bar');
        _progress = document.createElement('div');
        _progress.setAttribute('class', 'grplayer-progress');
      _progressBar.appendChild(_progress);
    _player.appendChild(_progressBar);
      _content = document.createElement('div');
      _content.setAttribute('class', 'grplayer-content');
        _product = document.createElement('div');
        _product.setAttribute('class', 'grplayer-product');
      _content.appendChild(_product);
        _eventOverlay = document.createElement('div');
        _eventOverlay.setAttribute('class', 'grplayer-event_overlay');
      _content.appendChild(_eventOverlay);
    _player.appendChild(_content);

    var fullscreenButton = document.createElement('a');
    fullscreenButton.setAttribute('class', 'grplayer-fullscreen-button');
    fullscreenButton.onclick = function() {
      _toggleFullscreen();
    };
    _content.appendChild(fullscreenButton);

    _root.appendChild(_player);

    _attachMouseEvents();
    _loader.load();
  };

  (function start() {
    if (!settings.element) {
      if (console) {
        console.error('GetRotate.Player: No root element.');
      }
      return;
    }
    _root = settings.element;

    if (!settings.model) {
      if (console) {
        console.error('GetRotate.Player: No model.');
      }
      return;
    }
    if (typeof settings.model === "object") {
      _model = settings.model;
      _init();
    }
  }());

  // public section
  this.resize = function() {
    _fixProductSize();
  };
};
