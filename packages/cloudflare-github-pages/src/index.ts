import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

// See step 5 of
// https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain
const githubPagesDnsServers = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
];

export class CloudflareGithubPages extends pulumi.ComponentResource {
    public static apex(
        name: string,
        {
            zoneId,
            zone,
        }: {
            zoneId: pulumi.Input<string>;
            zone?: pulumi.Input<string>;
        },
        opts?: pulumi.ComponentResourceOptions,
    ): CloudflareGithubPages {
        return new CloudflareGithubPages(
            name,
            {
                zoneId,
                domainName: "@",
                wwwCname: zone ?? null,
            },
            opts,
        );
    }

    public static subdomain(
        name: string,
        {
            zoneId,
            subdomain,
        }: {
            zoneId: pulumi.Input<string>;
            subdomain: pulumi.Input<string>;
        },
        opts?: pulumi.ComponentResourceOptions,
    ): CloudflareGithubPages {
        return new CloudflareGithubPages(
            name,
            {
                zoneId,
                domainName: subdomain,
                wwwCname: null,
            },
            opts,
        );
    }

    public readonly aRecords: ReadonlyArray<cloudflare.Record>;
    public readonly cnameRecord: null | cloudflare.Record;

    private constructor(
        name: string,
        {
            zoneId,
            domainName,
            wwwCname,
        }: {
            zoneId: pulumi.Input<string>;
            domainName: pulumi.Input<string>;
            wwwCname: null | pulumi.Input<string>;
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super("zeroindexed:cloudflare-github-pages", name, {}, opts);

        this.aRecords = githubPagesDnsServers.map((ip, index) => {
            return new cloudflare.Record(
                `domain${index}`,
                {
                    zoneId,
                    name: domainName,
                    value: ip,
                    type: "A",
                },
                {
                    ...opts,
                    parent: this,
                },
            );
        });

        this.cnameRecord =
            wwwCname == null
                ? null
                : new cloudflare.Record(
                      "cname",
                      {
                          zoneId,
                          name: "www",
                          value: wwwCname,
                          type: "CNAME",
                      },
                      {
                          ...opts,
                          parent: this,
                      },
                  );
    }
}
