package douyin

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/Mournerliao/watermark-remover/apps/server/internal/httpapi"
)

var links = regexp.MustCompile(`https?://[^\s<>"“”]+`)
var workPath = regexp.MustCompile(`^/(?:video|note|slides)/([0-9]{19})/?$`)
var sharePath = regexp.MustCompile(`^/share/(?:video|note|slides)/([0-9]{19})/?$`)
var shortPath = regexp.MustCompile(`^/[A-Za-z0-9_-]+/?$`)
var userPath = regexp.MustCompile(`^/user/[A-Za-z0-9_-]+/?$`)
var workID = regexp.MustCompile(`^[0-9]{19}$`)

func pageHost(host string) bool {
	return host == "douyin.com" || host == "www.douyin.com" || host == "v.douyin.com" || host == "www.iesdouyin.com"
}

// imageHost deliberately allows only the Douyin image CDN family. See README:
// no live sample has been verified; add other CDN families only with evidence.
func imageHost(host string) bool {
	return strings.HasSuffix(host, ".douyinpic.com")
}

// Video CDN family, validated again on every redirect and public-IP dial.
func videoHost(host string) bool { return strings.HasSuffix(host, ".douyinvod.com") }

func itemID(u *url.URL) string {
	pattern := workPath
	if u.Hostname() == "www.iesdouyin.com" {
		pattern = sharePath
	}
	if match := pattern.FindStringSubmatch(u.Path); len(match) == 2 {
		return match[1]
	}
	if (u.Hostname() == "douyin.com" || u.Hostname() == "www.douyin.com") && userPath.MatchString(u.Path) {
		ids := u.Query()["modal_id"]
		if len(ids) == 1 && workID.MatchString(ids[0]) {
			return ids[0]
		}
	}
	return ""
}

func ExtractURL(text string) (*url.URL, error) {
	if len(text) > 8192 {
		return nil, httpapi.Fail(400, "分享内容过长")
	}
	var selected *url.URL
	for _, value := range links.FindAllString(text, -1) {
		u, err := url.Parse(strings.TrimRight(value, "，。！；、）)]}"))
		if err != nil || !pageHost(strings.ToLower(u.Hostname())) {
			continue
		}
		if u.User != nil || (u.Port() != "" && u.Port() != "443" && u.Port() != "80") {
			return nil, httpapi.Fail(400, "分享链接无效")
		}
		if selected != nil {
			return nil, httpapi.Fail(400, "每次仅支持一个抖音链接")
		}
		u.Fragment, u.Scheme, u.Host = "", "https", strings.ToLower(u.Hostname())
		selected = u
	}
	if selected == nil {
		return nil, httpapi.Fail(400, "未找到有效的抖音分享链接")
	}
	if selected.Hostname() == "v.douyin.com" {
		if shortPath.MatchString(selected.Path) {
			return selected, nil
		}
	} else if itemID(selected) != "" {
		return selected, nil
	}
	return nil, httpapi.Fail(400, "仅支持公开作品分享链接")
}
