% make sure library path is expanded
:- register_ros_package(knowrob_openease).
:- register_ros_package(knowrob).

% load query tunnling
:- use_module('./charts.pl').