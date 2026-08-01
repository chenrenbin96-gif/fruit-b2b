FROM mysql:8.0.39

RUN microdnf install -y cronie findutils tzdata \
    && microdnf clean all
COPY infra/backup /opt/backup
RUN chmod 0755 /opt/backup/*.sh

ENTRYPOINT ["/opt/backup/entrypoint.sh"]
