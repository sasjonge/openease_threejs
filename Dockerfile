FROM ubuntu
ADD . /opt/webapp/webrob/static/lib/vis
VOLUME /opt/webapp/webrob/static/lib/vis
CMD /bin/sh
